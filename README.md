# Vacinaí - Sistema Especialista em Vacinação com IA e Cache Semântico

O **Vacinaí** é um assistente especialista desenvolvido em **Node.js** e **TypeScript** dedicado a orientar sobre o Programa Nacional de Imunizações (PNI) do Brasil, imunizações por faixa etária (crianças, adolescentes, adultos, idosos e gestantes), contraindicações, mitos comuns e esclarecimento de dúvidas sobre vacinas.

---

## Componentes da Solução

1. **Chat Especialista (CLI Interativo)**: Interface conversacional interativa em linha de comando que mantém a persona do especialista "Vacinaí", restringe respostas fora do escopo médico de imunização e exibe se a resposta foi obtida do cache ou inferida pelo LLM.
2. **Motor de Inferência**: Conecta-se a grandes modelos de IA com suporte flexível para:
   - **Ollama local** (ex.: `qwen2.5:1.5b`, `llama3.2`) rodando localmente ou via container.
   - **Google Gemini** (ex.: `gemini-2.5-flash`, `gemini-1.5-flash`) via chave de API.
3. **Cache Semântico Vetorial**: Sistema de cache baseado em embeddings e distância por cosseno com limiar de distância de `0.20` (similaridade cosseno $\ge 0.80$).
   - Conexão nativa com **ChromaDB** via container Docker na porta `8000`.
   - Armazenamento persistente local em arquivo JSON (`cache/vacinai_cache.json`) integrado para garantir funcionamento contínuo.
4. **Base de Conhecimento Estruturada**: Base com dezenas de perguntas e respostas autoritativas sobre o calendário oficial do SUS em `conhecimento/vacinacao.json`.

---

## Como Subir e Preparar os Containers

O projeto já inclui um arquivo `docker-compose.yml` pré-configurado com os serviços necessários:

```yaml
services:
  chroma:
    image: chromadb/chroma:latest
    container_name: vacinai-chroma
    ports:
      - "8000:8000"
    environment:
      - IS_PERSISTENT=TRUE
      - ANONYMIZED_TELEMETRY=FALSE
    volumes:
      - dados_chroma:/chroma/chroma

  ollama:
    image: ollama/ollama:latest
    container_name: vacinai-ollama
    ports:
      - "11434:11434"
    volumes:
      - dados_ollama:/root/.ollama

volumes:
  dados_chroma:
  dados_ollama:
```

### Passo 1: Iniciar os containers

Execute no terminal:

```bash
docker compose up -d
```

### Passo 2: Baixar os modelos no Ollama

Após o container do Ollama iniciar, baixe o modelo de linguagem e o modelo de embeddings desejados:

```bash
docker exec -it vacinai-ollama ollama pull qwen2.5:1.5b
docker exec -it vacinai-ollama ollama pull nomic-embed-text
```

Se preferir usar o modelo `llama3.2` ou outro modelo:

```bash
docker exec -it vacinai-ollama ollama pull llama3.2
```

---

## Configuração do Ambiente (.env)

Copie o arquivo de exemplo para criar seu `.env`:

```bash
cp .env.example .env
```

Parâmetros disponíveis no `.env`:

```env
PROVEDOR_LLM=ollama
URL_OLLAMA=http://localhost:11434/v1
MODELO_OLLAMA=qwen2.5:1.5b
CHAVE_API_GEMINI=
MODELO_GEMINI=gemini-2.5-flash
PROVEDOR_ARMAZENAMENTO_CACHE=local
PROVEDOR_EMBEDDING=local
URL_CHROMA=http://localhost:8000
NOME_COLECAO_CACHE=vacinai_cache
LIMIAR_DISTANCIA_CACHE=0.20
CAMINHO_CACHE_LOCAL=cache/vacinai_cache.json
MODELO_EMBEDDING_OLLAMA=nomic-embed-text
MODELO_EMBEDDING_GEMINI=text-embedding-004
```

> **Dica**: Se quiser utilizar o Google Gemini em vez do Ollama, defina `PROVEDOR_LLM=gemini` e informe sua chave em `CHAVE_API_GEMINI`.

---

## Como Executar a Aplicação

### 1. Instalar as dependências

```bash
npm install
```

### 2. Iniciar o Chat com o Especialista

Em modo desenvolvimento:

```bash
npm run dev
```

Ou compilar e iniciar a versão de produção:

```bash
npm run build
npm start
```

---

## Exemplo de Interação

```text
=======================================================
         💉 BEM-VINDO AO ESPECIALISTA VACINAÍ 💉        
   Tire dúvidas sobre vacinas, doses e imunizações.    
       (Digite 'sair' ou pressione Ctrl+C para fechar) 
=======================================================

👤 Qual a função da vacina BCG?
🤖 A vacina BCG (Bacilo Calmette-Guérin) protege contra as formas graves da tuberculose, como a meningite tuberculosa e a tuberculose miliar. [resposta do llm]

👤 Para que serve a vacina BCG?
🤖 A vacina BCG (Bacilo Calmette-Guérin) protege contra as formas graves da tuberculose, como a meningite tuberculosa e a tuberculose miliar. [recuperada do cache]

👤 Quem descobriu o Brasil?
🤖 não posso responder esta pergunta [resposta do llm]

👤 sair
🤖 Até logo! Mantenha sempre sua caderneta de vacinação em dia.
```
