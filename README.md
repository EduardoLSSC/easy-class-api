# EasyClass API

Backend **Fastify** com PostgreSQL (**Drizzle** + **pgvector**), autenticação **JWT**, upload de áudio e integração **Google Gemini** (transcrição, embeddings e respostas com contexto).

## Pré-requisitos

- Node.js 20+ (recomendado)
- Docker (Postgres com extensões `uuid-ossp` e `vector`)
- Chave **GEMINI_API_KEY** ([Google AI Studio](https://aistudio.google.com/))

## Banco de dados

Na raiz desta pasta:

```bash
docker compose up -d
```

- **Host:** `localhost`
- **Porta:** `5433` → mapeada para `5432` no container
- **Usuário / senha / banco:** `docker` / `docker` / `agents`

O arquivo `docker/setup.sql` roda na inicialização do container e habilita as extensões necessárias.

## Configuração

```bash
cp .env.example .env
```

| Variável | Descrição |
|----------|-----------|
| `PORT` | Porta HTTP (padrão `3333`) |
| `DATABASE_URL` | Ex.: `postgresql://docker:docker@localhost:5433/agents` |
| `GEMINI_API_KEY` | Chave da API Gemini |
| `JWT_SECRET` | Mínimo **16 caracteres**; use valor forte em produção |
| `DEFAULT_USER_ID` | (Opcional) UUID para seed / testes |

## Instalação e migrações

```bash
npm install
npm run db:migrate
npm run db:seed
```

Após o seed, usuário local: **dev@local.test** / **dev**.

## Rodar em desenvolvimento

```bash
npm run dev
```

Servidor: `http://localhost:${PORT}` (ex.: `http://localhost:3333`).

- Health: `GET /health`

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor com reload (`tsx --watch`) |
| `npm run start` | Uma execução com `.env` |
| `npm run db:generate` | Gerar migrações Drizzle a partir do schema |
| `npm run db:migrate` | Aplicar migrações |
| `npm run db:seed` | Dados iniciais (usuário dev + sala exemplo) |
| `npm run typecheck` | `tsc --noEmit` |

## CORS

Por padrão a API aceita origem `http://localhost:5173` (Vite). Para outra URL/porta do front, altere em `src/server.ts`.

## Problemas comuns

- **5432 ocupada no host** — Use `:5433` na `DATABASE_URL` (como no `.env.example`).
- **Transcrição / Gemini** — Verifique `GEMINI_API_KEY`, cota e billing no Google AI.
- **401 no front** — Confirme `JWT_SECRET`, login e header `Authorization`.
