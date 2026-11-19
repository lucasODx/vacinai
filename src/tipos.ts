export interface Mensagem {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ItemConhecimento {
  pergunta: string;
  resposta: string;
}

export interface ResultadoLLM {
  sucesso: boolean;
  resposta: string | null;
  consumoTokens?: {
    entrada?: number;
    saida?: number;
    total?: number;
  };
}

export interface ConfiguracaoLLM {
  urlOllama: string;
  modeloOllama: string;
}
