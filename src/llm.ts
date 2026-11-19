import { config } from "dotenv";
import { ConfiguracaoLLM, Mensagem, ResultadoLLM } from "./tipos.js";

config();

export function obterConfiguracaoLLM(): ConfiguracaoLLM {
  return {
    urlOllama: process.env.URL_OLLAMA || "http://localhost:11434/v1",
    modeloOllama: process.env.MODELO_OLLAMA || "qwen2.5:0.5b",
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

export async function iniciarLLM(
  configuracaoUsuario?: Partial<ConfiguracaoLLM>
): Promise<{ iniciado: boolean; configuracao: ConfiguracaoLLM }> {
  const configuracao: ConfiguracaoLLM = {
    ...obterConfiguracaoLLM(),
    ...configuracaoUsuario,
  };

  try {
    const urlBase = configuracao.urlOllama.replace(/\/v1\/?$/, "");
    await fetch(`${urlBase}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    }).catch(() => null);

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
    return await requisitarOllama(mensagens, configuracao);
  } catch (erro) {
    console.error(`Ocorreu um erro ao obter resposta do modelo: ${erro}`);
    return {
      sucesso: false,
      resposta: null,
    };
  }
}
