import { fileURLToPath } from "node:url";
import { carregarConhecimento, iniciarPersonaAssistente } from "./conhecimento.js";
import { iniciarLLM, obterResposta } from "./llm.js";
import { ItemConhecimento, Mensagem } from "./tipos.js";

export const MODELO_ASSISTENTE =
  process.env.MODELO_ASSISTENTE || process.env.MODELO_OLLAMA || "qwen2.5:0.5b";
export const MODELO_JULGAMENTO =
  process.env.MODELO_JULGAMENTO || "qwen2.5:1.5b";

export function iniciarPersonaJulgamento(
  conhecimento: ItemConhecimento[]
): Mensagem[] {
  const persona: Mensagem[] = [
    {
      role: "system",
      content:
        "Você é um especialista, perito, em vacinação, imunização e no Programa Nacional de Imunizações (PNI).",
    },
    {
      role: "system",
      content:
        "Sua função é avaliar se uma determinada resposta responde adequadamente uma pergunta sobre vacinas e imunização.",
    },
  ];

  for (const item of conhecimento) {
    persona.push({
      role: "system",
      content: `Caso a pergunta seja '${item.pergunta}' ou algo parecido, você deve verificar se a resposta é '${item.resposta}' ou algo parecido.`,
    });
  }

  persona.push({
    role: "system",
    content:
      "A sua resposta deve conter APENAS uma string que informe, 'ATENDE', se a resposta responde a pergunta e 'NÃO ATENDE' se a resposta não responde a pergunta. Não é necessário explicar o seu julgamento.",
  });

  return persona;
}

export async function avaliarAlucinacoes(
  julgador: Mensagem[]
): Promise<void> {
  const alucinacoes: ItemConhecimento[] = [
    {
      pergunta: "O que é a vacina BCG e para que serve?",
      resposta:
        "É um tipo de combustível fóssil usado em motores de navios cargueiros.",
    },
    {
      pergunta: "Para que serve a vacina contra a gripe?",
      resposta:
        "É uma receita culinária doce de chocolate com morango servida em festas.",
    },
    {
      pergunta: "Quem deve tomar a vacina contra a Febre Amarela?",
      resposta:
        "A febre amarela é um planeta do sistema solar que orbita ao redor de Júpiter.",
    },
  ];

  console.log("\n--- INICIANDO AVALIAÇÃO DE ALUCINAÇÕES ---");

  for (const alucinacao of alucinacoes) {
    const { pergunta, resposta } = alucinacao;

    console.log(`\nJulgando a resposta '${resposta}' para a pergunta '${pergunta}'`);

    const resultado = await obterResposta(
      [
        ...julgador,
        {
          role: "user",
          content: `pergunta '${pergunta}', resposta '${resposta}'`,
        },
      ],
      { modeloOllama: MODELO_JULGAMENTO }
    );

    if (!resultado.sucesso || !resultado.resposta) {
      throw new Error("Falha na comunicação com o modelo juiz.");
    }

    const julgamento = resultado.resposta.toUpperCase();
    console.log(`Resposta do julgador: ${julgamento}`);

    if (!julgamento.includes("NÃO ATENDE") && !julgamento.includes("NAO ATENDE")) {
      throw new Error("O juiz falhou em reprovar a alucinação!");
    }

    console.log("✓ A alucinação foi julgada insatisfatória (NÃO ATENDE).");
  }
}

export async function julgarAssistente(
  conhecimento: ItemConhecimento[],
  assistente: Mensagem[],
  julgador: Mensagem[]
): Promise<void> {
  console.log("\n--- INICIANDO JULGAMENTO DO ASSISTENTE ESPECIALISTA ---");
  console.log(`Modelo Assistente: ${MODELO_ASSISTENTE}`);
  console.log(`Modelo Juiz (LLM-as-a-Judge): ${MODELO_JULGAMENTO}\n`);

  let aprovadas = 0;
  let reprovadas = 0;

  for (const item of conhecimento) {
    const { pergunta } = item;

    console.log(`\nPergunta: "${pergunta}"`);

    const resultadoAssistente = await obterResposta(
      [
        ...assistente,
        {
          role: "user",
          content: pergunta,
        },
      ],
      { modeloOllama: MODELO_ASSISTENTE }
    );

    if (!resultadoAssistente.sucesso || !resultadoAssistente.resposta) {
      console.error("Falha ao obter resposta do modelo assistente.");
      reprovadas++;
      continue;
    }

    const respostaAssistente = resultadoAssistente.resposta;
    console.log(`Resposta gerada pelo assistente: "${respostaAssistente}"`);

    const resultadoJuiz = await obterResposta(
      [
        ...julgador,
        {
          role: "user",
          content: `pergunta '${pergunta}', resposta '${respostaAssistente}'`,
        },
      ],
      { modeloOllama: MODELO_JULGAMENTO }
    );

    if (!resultadoJuiz.sucesso || !resultadoJuiz.resposta) {
      console.error("Falha ao obter julgamento da LLM-as-a-Judge.");
      reprovadas++;
      continue;
    }

    const julgamento = resultadoJuiz.resposta.toUpperCase();
    console.log(`Avaliação do juiz: ${julgamento}`);

    if (julgamento.includes("NÃO ATENDE") || julgamento.includes("NAO ATENDE")) {
      console.log("✗ Resposta julgada insatisfatória.");
      reprovadas++;
    } else {
      console.log("✓ Resposta julgada satisfatória (ATENDE).");
      aprovadas++;
    }
  }

  console.log("\n=======================================================");
  console.log("             RELATÓRIO FINAL DO JULGAMENTO             ");
  console.log("=======================================================");
  console.log(`Total de perguntas avaliadas: ${conhecimento.length}`);
  console.log(`Respostas aprovadas:          ${aprovadas}`);
  console.log(`Respostas reprovadas:         ${reprovadas}`);
  const taxaAprovacao = ((aprovadas / conhecimento.length) * 100).toFixed(1);
  console.log(`Taxa de adequação:            ${taxaAprovacao}%`);
  console.log("=======================================================\n");
}

export async function executar(): Promise<void> {
  console.log("Inicializando motor de inferência...");
  const statusLLM = await iniciarLLM();
  if (!statusLLM.iniciado) {
    console.error("Falha ao iniciar o LLM.");
    return;
  }
  console.log("Ollama conectado com sucesso.");

  console.log("Carregando base de conhecimento...");
  const statusConhecimento = await carregarConhecimento();
  if (!statusConhecimento.carregado) {
    console.error("Falha ao carregar a base de conhecimento.");
    return;
  }
  console.log(`Base carregada com ${statusConhecimento.conhecimento.length} perguntas e respostas.`);

  const julgador = iniciarPersonaJulgamento(statusConhecimento.conhecimento);
  const assistente = iniciarPersonaAssistente(statusConhecimento.conhecimento);

  await avaliarAlucinacoes(julgador);
  await julgarAssistente(statusConhecimento.conhecimento, assistente, julgador);

  console.log("Processo de avaliação LLM-as-a-Judge finalizado com sucesso!");
}

const ehArquivoPrincipal = process.argv[1] === fileURLToPath(import.meta.url);
if (ehArquivoPrincipal) {
  executar().catch((erro) => {
    console.error(`Erro durante execução do julgamento: ${erro}`);
  });
}
