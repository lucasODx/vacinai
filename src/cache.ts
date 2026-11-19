import { createHash } from "node:crypto";
import { ChromaClient, Collection, IncludeEnum } from "chromadb";
import { config } from "dotenv";

config();

export const LIMIAR_DISTANCIA_CACHE = 0.20;
const URL_CHROMA = process.env.URL_CHROMA || "http://localhost:8000";
const NOME_COLECAO = process.env.NOME_COLECAO_CACHE || "vacinai_cache";
const URL_OLLAMA = process.env.URL_OLLAMA || "http://localhost:11434";
const MODELO_EMBEDDING = process.env.MODELO_EMBEDDING_OLLAMA || "nomic-embed-text";

let colecaoCache: Collection | null = null;

export function normalizarPergunta(pergunta: string): string {
  return pergunta.toLowerCase().trim().replace(/\s+/g, " ");
}

export function gerarIdCache(pergunta: string): string {
  return createHash("sha256").update(normalizarPergunta(pergunta)).digest("hex");
}

export async function gerarEmbedding(texto: string): Promise<number[]> {
  const chaveGemini = process.env.CHAVE_API_GEMINI || process.env.GOOGLE_API_KEY;

  if (chaveGemini) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${chaveGemini}`;
    const resposta = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/text-embedding-004",
        content: { parts: [{ text: texto }] },
      }),
    });
    const dados = (await resposta.json()) as { embedding?: { values?: number[] } };
    return dados?.embedding?.values || [];
  }

  const urlBase = URL_OLLAMA.replace(/\/v1\/?$/, "");
  const resposta = await fetch(`${urlBase}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODELO_EMBEDDING, prompt: texto }),
  });

  const dados = (await resposta.json()) as { embedding?: number[] };
  return dados?.embedding || [];
}

export async function iniciarCache(): Promise<boolean> {
  try {
    const cliente = new ChromaClient({ path: URL_CHROMA });

    colecaoCache = await cliente.getOrCreateCollection({
      name: NOME_COLECAO,
      metadata: { "hnsw:space": "cosine" },
    });

    return true;
  } catch (erro) {
    console.error(`Cache semântico indisponível: ${erro}`);
    return false;
  }
}

export async function buscarCache(
  pergunta: string
): Promise<{ encontrada: boolean; resposta: string | null }> {
  if (!colecaoCache) {
    return { encontrada: false, resposta: null };
  }

  try {
    const embedding = await gerarEmbedding(pergunta);
    if (embedding.length === 0) {
      return { encontrada: false, resposta: null };
    }

    const resultado = await colecaoCache.query({
      queryEmbeddings: [embedding],
      nResults: 1,
      include: [IncludeEnum.Metadatas, IncludeEnum.Distances],
    });

    const distancia = resultado.distances?.[0]?.[0] ?? 1;
    const resposta = (resultado.metadatas?.[0]?.[0]?.resposta as string) || null;

    const encontrada = resposta !== null && distancia <= LIMIAR_DISTANCIA_CACHE;
    return { encontrada, resposta: encontrada ? resposta : null };
  } catch (erro) {
    console.error(`Ocorreu um erro consultando o cache semântico: ${erro}`);
    return { encontrada: false, resposta: null };
  }
}

export async function gravarCache(
  pergunta: string,
  resposta: string
): Promise<void> {
  if (!colecaoCache || !pergunta.trim() || !resposta.trim()) {
    return;
  }

  try {
    const embedding = await gerarEmbedding(pergunta);
    if (embedding.length === 0) {
      return;
    }

    await colecaoCache.upsert({
      ids: [gerarIdCache(pergunta)],
      embeddings: [embedding],
      documents: [pergunta],
      metadatas: [{ pergunta, resposta }],
    });
  } catch (erro) {
    console.error(`Ocorreu um erro gravando no cache semântico: ${erro}`);
  }
}
