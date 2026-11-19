import { config } from "dotenv";
import { ConfiguracaoLLM, Mensagem, ResultadoLLM } from "./tipos.js";

config();

export function obterConfiguracaoLLM(): ConfiguracaoLLM {
  return {
    provedor: (process.env.PROVEDOR_LLM || "ollama") as "ollama" | "gemini",
    urlOllama: process.env.URL_OLLAMA || "http://localhost:11434/v1",
    modeloOllama: process.env.MODELO_OLLAMA || "qwen2.5:1.5b",
    chaveGemini: process.env.CHAVE_API_GEMINI || process.env.GOOGLE_API_KEY || "",
    modeloGemini: process.env.MODELO_GEMINI || "gemini-2.5-flash",
  };
}

async function requisitarOllama(
  mensagens: Mensagem[],
  configuracao: ConfiguracaoLLM
): Promise<ResultadoLLM> {
  const urlLimpa = configuracao.urlOllama.replace(/\/+$/, "");
  const urlFinal = urlLimpa.endsWith("/v1")
    ? `${urlLimpa}/chat/completions`
    : `${urlLimpa}/v1/chat/completions`;

  const corpoRequisicao = {
    model: configuracao.modeloOllama,
    messages: mensagens,
    temperature: 0.1,
  };

  const respostaHttp = await fetch(urlFinal, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer ollama",
    },
    body: JSON.stringify(corpoRequisicao),
  });

  if (!respostaHttp.ok) {
    const textoErro = await respostaHttp.text();
    throw new Error(`Erro na chamada ao Ollama (${respostaHttp.status}): ${textoErro}`);
  }

  const dados = (await respostaHttp.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };
  const textoResposta = dados?.choices?.[0]?.message?.content;

  if (!textoResposta) {
    throw new Error("Ollama retornou uma resposta sem conteúdo de texto.");
  }

  return {
    sucesso: true,
    resposta: String(textoResposta).trim(),
    consumoTokens: {
      entrada: dados?.usage?.prompt_tokens,
      saida: dados?.usage?.completion_tokens,
      total: dados?.usage?.total_tokens,
    },
  };
}

async function requisitarGemini(
  mensagens: Mensagem[],
  configuracao: ConfiguracaoLLM
): Promise<ResultadoLLM> {
  if (!configuracao.chaveGemini) {
    throw new Error("Chave de API do Gemini não configurada (defina CHAVE_API_GEMINI ou GOOGLE_API_KEY).");
  }

  const instrucoesSistema = mensagens
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");

  const conteudos = mensagens
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${configuracao.modeloGemini}:generateContent?key=${configuracao.chaveGemini}`;

  const corpo: Record<string, unknown> = {
    contents: conteudos,
    generationConfig: {
      temperature: 0.1,
    },
  };

  if (instrucoesSistema) {
    corpo.systemInstruction = {
      parts: [{ text: instrucoesSistema }],
    };
  }

  const respostaHttp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(corpo),
  });

  if (!respostaHttp.ok) {
    const textoErro = await respostaHttp.text();
    throw new Error(`Erro na chamada ao Gemini (${respostaHttp.status}): ${textoErro}`);
  }

  const dados = (await respostaHttp.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
  };
  const textoResposta = dados?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textoResposta) {
    throw new Error("Gemini retornou uma resposta vazia.");
  }

  return {
    sucesso: true,
    resposta: String(textoResposta).trim(),
    consumoTokens: {
      entrada: dados?.usageMetadata?.promptTokenCount,
      saida: dados?.usageMetadata?.candidatesTokenCount,
      total: dados?.usageMetadata?.totalTokenCount,
    },
  };
}

export async function iniciarLLM(
  configuracaoUsuario?: Partial<ConfiguracaoLLM>
): Promise<{ iniciado: boolean; configuracao: ConfiguracaoLLM }> {
  const configuracao: ConfiguracaoLLM = {
    ...obterConfiguracaoLLM(),
    ...configuracaoUsuario,
  };

  try {
    if (configuracao.provedor === "ollama") {
      const urlBase = configuracao.urlOllama.replace(/\/v1\/?$/, "");
      const respostaTeste = await fetch(`${urlBase}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(3000),
      }).catch(() => null);

      if (respostaTeste && respostaTeste.ok) {
        return { iniciado: true, configuracao };
      }
      return { iniciado: true, configuracao };
    }

    if (configuracao.provedor === "gemini") {
      if (!configuracao.chaveGemini) {
        return { iniciado: false, configuracao };
      }
      return { iniciado: true, configuracao };
    }

    return { iniciado: true, configuracao };
  } catch (erro) {
    console.error(`Ocorreu um problema iniciando o LLM: ${erro}`);
    return { iniciado: false, configuracao };
  }
}

export async function obterResposta(
  mensagens: Mensagem[],
  configuracaoUsuario?: Partial<ConfiguracaoLLM>
): Promise<ResultadoLLM> {
  const configuracao: ConfiguracaoLLM = {
    ...obterConfiguracaoLLM(),
    ...configuracaoUsuario,
  };

  try {
    if (configuracao.provedor === "gemini") {
      return await requisitarGemini(mensagens, configuracao);
    }
    return await requisitarOllama(mensagens, configuracao);
  } catch (erro) {
    console.error(`Ocorreu um erro ao obter resposta do modelo: ${erro}`);
    return {
      sucesso: false,
      resposta: null,
    };
  }
}
