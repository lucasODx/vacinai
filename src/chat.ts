import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { carregarConhecimento, iniciarPersonaAssistente } from "./conhecimento.js";
import { iniciarLLM, obterResposta } from "./llm.js";
import { buscarCache, gravarCache, iniciarCache } from "./cache.js";
import { Mensagem } from "./tipos.js";

async function executar(): Promise<void> {
  console.log("Iniciando componentes do Vacinaí...");

  const statusLLM = await iniciarLLM();
  if (!statusLLM.iniciado) {
    console.error("Falha ao iniciar conexão com o modelo de linguagem.");
    return;
  }
  console.log(`Motor de inferência iniciado (Modelo: ${statusLLM.configuracao.modeloOllama}).`);

  const statusConhecimento = await carregarConhecimento();
  if (!statusConhecimento.carregado) {
    console.error("Falha ao carregar a base de conhecimento de vacinação.");
    return;
  }
  console.log(`Base de conhecimento carregada com sucesso (${statusConhecimento.conhecimento.length} itens).`);

  const cacheIniciado = await iniciarCache();
  if (cacheIniciado) {
    console.log("Cache semântico iniciado com sucesso.");
  } else {
    console.log("Aviso: cache semântico não conectado ao ChromaDB.");
  }

  const persona = iniciarPersonaAssistente(statusConhecimento.conhecimento);

  console.log("\n=======================================================");
  console.log("         💉 BEM-VINDO AO ESPECIALISTA VACINAÍ 💉        ");
  console.log("   Tire dúvidas sobre vacinas, doses e imunizações.    ");
  console.log("       (Digite 'sair' ou pressione Ctrl+C para fechar) ");
  console.log("=======================================================\n");

  const leitor = createInterface({ input, output });

  try {
    while (true) {
      const mensagemBruta = await leitor.question("👤 ");
      const mensagem = mensagemBruta.trim();

      if (!mensagem) {
        continue;
      }

      const comandoSaida = ["sair", "exit", "tchau", "fim", "encerrar"];
      if (comandoSaida.includes(mensagem.toLowerCase())) {
        console.log("🤖 Até logo! Mantenha sempre sua caderneta de vacinação em dia.");
        break;
      }

      const { encontrada, resposta: respostaCache } = await buscarCache(mensagem);

      if (encontrada && respostaCache) {
        console.log(`🤖 ${respostaCache} [recuperada do cache]`);
        continue;
      }

      const mensagensParaLLM: Mensagem[] = [
        ...persona,
        {
          role: "user",
          content: mensagem,
        },
      ];

      process.stdout.write("🤖 Pensando...");
      const { sucesso, resposta: respostaLLM } = await obterResposta(mensagensParaLLM);
      process.stdout.write("\r\x1b[K");

      if (sucesso && respostaLLM) {
        console.log(`🤖 ${respostaLLM} [resposta do llm]`);
        await gravarCache(mensagem, respostaLLM);
      } else {
        console.log("🤖 Não sei responder esta pergunta, por favor faça outra pergunta sobre vacinação.");
      }
    }
  } finally {
    leitor.close();
  }
}

executar().catch((erro) => {
  console.error(`Erro crítico durante execução do chat: ${erro}`);
});
