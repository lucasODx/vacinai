import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ItemConhecimento, Mensagem } from "./tipos.js";

export const CAMINHO_BASE_CONHECIMENTO = resolve("conhecimento/vacinacao.json");
export const NOME_ESPECIALISTA = "Vacinaí";

export async function carregarConhecimento(
  caminhoArquivo: string = CAMINHO_BASE_CONHECIMENTO
): Promise<{ carregado: boolean; conhecimento: ItemConhecimento[] }> {
  try {
    const conteudoBruto = await readFile(caminhoArquivo, "utf-8");
    const dados = JSON.parse(conteudoBruto) as ItemConhecimento[];

    const conhecimento: ItemConhecimento[] = dados.map((item) => ({
      pergunta: String(item.pergunta).trim(),
      resposta: String(item.resposta).trim(),
    }));

    return { carregado: true, conhecimento };
  } catch (erro) {
    console.error(`Erro ao carregar base de conhecimento: ${erro}`);
    return { carregado: false, conhecimento: [] };
  }
}

export function iniciarPersonaAssistente(
  conhecimento: ItemConhecimento[],
  nomeEspecialista: string = NOME_ESPECIALISTA
): Mensagem[] {
  const regras = conhecimento
    .map(
      (item) =>
        `- Pergunta: '${item.pergunta}' -> Resposta: '${item.resposta}'`
    )
    .join("\n");

  return [
    {
      role: "system",
      content: `Você é um especialista, perito, em vacinação, imunização e no Programa Nacional de Imunizações (PNI), chamado ${nomeEspecialista}. Se o usuário fizer uma saudação, fale na sua resposta que você é um software, não é um humano, mas que pode ajudar com vacinas e calendário de vacinação. O seu nome é ${nomeEspecialista}. Se o usuário perguntar algo que não esteja relacionado com vacinação, vacinas ou imunização, responda estritamente 'não posso responder esta pergunta'. Baseie suas respostas nas seguintes diretrizes:\n${regras}`,
    },
  ];
}
