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

export type TipoProvedorLLM = "ollama" | "gemini";

export interface ConfiguracaoLLM {
  provedor: TipoProvedorLLM;
  urlOllama: string;
  modeloOllama: string;
  chaveGemini: string;
  modeloGemini: string;
}
