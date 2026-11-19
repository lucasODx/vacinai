# Vacinaí - Sistema Especialista em Vacinação com IA e Cache Semântico

O **Vacinaí** é um assistente especialista desenvolvido em **Node.js** e **TypeScript** dedicado a orientar sobre o Programa Nacional de Imunizações (PNI) do Brasil, imunizações por faixa etária (crianças, adolescentes, adultos, idosos e gestantes), contraindicações, mitos comuns e esclarecimento de dúvidas sobre vacinas.

---

## Componentes da Solução

1. **Chat Especialista (CLI Interativo)**: Interface conversacional interativa em linha de comando que mantém a persona do especialista "Vacinaí", restringe respostas fora do escopo médico de imunização e exibe se a resposta foi obtida do cache ou inferida pelo LLM.
2. **Motor de Inferência (Ollama)**: Conecta-se à API local do **Ollama** utilizando o modelo leve `qwen2.5:0.5b` para responder com agilidade às dúvidas dos usuários.
3. **Cache Semântico Vetorial**: Sistema de cache baseado em embeddings e distância por cosseno com limiar de distância de `0.20` (similaridade cosseno $\ge 0.80$).
   - Conexão com o banco vetorial **ChromaDB** via container Docker na porta `8000`.
   - Embeddings gerados diretamente pelo modelo `nomic-embed-text` no Ollama.
4. **Base de Conhecimento Estruturada**: Base com dezenas de perguntas e respostas autoritativas sobre o calendário oficial do SUS em `conhecimento/vacinacao.json`.
5. **Avaliação LLM-as-a-Judge**: Script para avaliar o desempenho e a precisão do assistente especialista (`qwen2.5:0.5b`) utilizando um modelo juiz (`qwen2.5:1.5b`), testando alucinações propositais e gerando métricas de adequação.

## Como Subir e Preparar os Containers

O projeto inclui um arquivo `docker-compose.yml` pré-configurado com os serviços necessários:

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

Após o container do Ollama iniciar, baixe os modelos necessários:

```bash
# Modelo leve para responder as perguntas do especialista
docker exec -it vacinai-ollama ollama pull qwen2.5:0.5b

# Modelo para atuar como Juiz (LLM-as-a-Judge)
docker exec -it vacinai-ollama ollama pull qwen2.5:1.5b

# Modelo para geração de embeddings no cache semântico
docker exec -it vacinai-ollama ollama pull nomic-embed-text
```

---

## Configuração do Ambiente (.env)

Copie o arquivo de exemplo para criar seu `.env`:

```bash
cp .env.example .env
```

Conteúdo configurado no `.env`:

```env
URL_OLLAMA=http://localhost:11434/v1
MODELO_OLLAMA=qwen2.5:0.5b
MODELO_ASSISTENTE=qwen2.5:0.5b
MODELO_JULGAMENTO=qwen2.5:1.5b
URL_CHROMA=http://localhost:8000
NOME_COLECAO_CACHE=vacinai_cache
MODELO_EMBEDDING_OLLAMA=nomic-embed-text
```

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

### 3. Executar a Avaliação com LLM-as-a-Judge

O script de avaliação executa duas etapas fundamentais:
1. **Teste de Alucinações**: Envia propositalmente respostas absurdas e incorretas para garantir que o modelo juiz (`qwen2.5:1.5b`) reprove com `NÃO ATENDE`.
2. **Avaliação do Especialista**: O modelo assistente (`qwen2.5:0.5b`) responde a todas as perguntas da base de vacinação e o juiz avalia a adequação de cada resposta, emitindo um relatório com a taxa percentual de sucesso.

Para executar o julgamento:

```bash
npm run julgamento
```

---

## Exemplo de Interação no Chat

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
