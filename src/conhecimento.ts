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
  const persona: Mensagem[] = [
    {
      role: "system",
      content: `Você é um especialista, perito, em vacinação, imunização e no Programa Nacional de Imunizações (PNI), chamado ${nomeEspecialista}.`,
    },
    {
      role: "system",
      content:
        "Se o usuário fizer uma saudação, você deve falar na sua resposta que você é um software, não é um humano, mas que pode ajudar o usuário a entender sobre vacinas e calendário de vacinação.",
    },
    {
      role: "system",
      content: `O seu nome é ${nomeEspecialista}. Sempre se identifique com esse nome durante saudações.`,
    },
    {
      role: "system",
      content:
        "Se o usuário te perguntar algo que não esteja relacionado com vacinação, vacinas, imunização ou calendário vacinal, você deve dizer 'não posso responder esta pergunta'.",
    },
  ];

  for (const item of conhecimento) {
    persona.push({
      role: "system",
      content: `Caso o usuário fale ou pergunte '${item.pergunta}' ou algo parecido, sua resposta deve ser '${item.resposta}'`,
    });
  }

  return persona;
}
