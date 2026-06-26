# EasyClass API

<p align="center">
  <img src="https://img.shields.io/badge/status-em%20desenvolvimento-yellow" />
  <img src="https://img.shields.io/badge/node.js-20+-green" />
  <img src="https://img.shields.io/badge/license-MIT-blue" />
</p>

---

## Integrantes do Projeto

<details>
<summary><strong>Clique para ver todos os integrantes</strong></summary>

<br>

<table>
  <tr>
    <td align="center">
      <img src="https://github.com/sogayar.png" width="100px;" /><br>
      <strong>Henrique Sogayar</strong><br>
      <a href="https://www.linkedin.com/in/henriquesogayar/">LinkedIn</a>
    </td>
    <td align="center">
      <img src="https://github.com/EduardoLSSC.png" width="100px;" /><br>
      <strong>Eduardo Lindolfo</strong><br>
      <a href="#">LinkedIn</a>
    </td>
    <td align="center">
      <img src="https://github.com/kawz001.png" width="100px;" /><br>
      <strong>Kawe Alves</strong><br>
      <a href="#">LinkedIn</a>
    </td>
    <td align="center">
      <img src="https://github.com/Titao-Machado.png" width="100px;" /><br>
      <strong>Thiago Machado Filho</strong><br>
      <a href="#">LinkedIn</a>
    </td>
    <td align="center">
      <img src="https://github.com/MattMS0.png" width="100px;" /><br>
      <strong>Matheus Martins</strong><br>
      <a href="#">LinkedIn</a>
    </td>
  </tr>
</table>

</details>

---

## Descrição Geral da Solução

A **Easy Class API** é uma plataforma digital desenvolvida para auxiliar estudantes no processo de aprendizagem por meio do uso de inteligência artificial.

O objetivo da solução é tornar o estudo mais organizado, eficiente e adaptado às necessidades de cada usuário. O sistema permite que o estudante envie conteúdos acadêmicos em formato de texto ou áudio, como transcrições de aulas, que são processados pela inteligência artificial. A partir disso, a plataforma é capaz de gerar resumos, responder perguntas e ajudar na compreensão do conteúdo de forma mais clara.

A aplicação é estruturada em módulos que incluem cadastro e gerenciamento de usuários, interação com a IA, envio e transcrição de áudios, armazenamento de histórico e criação de planos de estudo. Além disso, o sistema mantém o contexto das interações, permitindo que o usuário continue suas dúvidas ao longo do tempo.

Backend **Fastify** com PostgreSQL (**Drizzle** + **pgvector**), autenticação **JWT**, upload de áudio e integração **Google Gemini** (transcrição, embeddings e respostas com contexto).

---

## Documentação Complementar

Para uma visão mais detalhada da arquitetura, fluxos, documentação, problema/solução e regras de negócio, acesse o material completo:

- [Link do Miro](https://miro.com/app/board/uXjVGyTkUWU=/?share_link_id=232020081815)
- [Link da descrição executiva](https://docs.google.com/document/d/1J-vPfHtJhT3nCbIc--Fy8I2hmcFFZNjOBB1__86omVQ/edit?usp=sharing)

---

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
| `GEMINI_MODEL` | Modelo principal (padrão `gemini-3.5-flash`) |
| `GEMINI_MODEL_FALLBACK` | Fallbacks separados por vírgula se o principal falhar |
| `JWT_SECRET` | Mínimo **16 caracteres**; use valor forte em produção |
| `DEFAULT_USER_ID` | (Opcional) UUID para seed / testes |

## Instalação e migrações

```bash
npm install
npm run db:migrate
npm run db:seed
```

Após o seed, contas locais:

| E-mail | Senha | Papel |
|--------|-------|--------|
| **dev@local.test** | **dev** | Professor |
| **admin@local.test** | **admin** | Administrador |
| **student@local.test** | **student** | Aluno (exemplo vinculado à sala do dev, se existir) |

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
- **Transcrição / Gemini** — Verifique `GEMINI_API_KEY`, cota e billing no Google AI. Modelos 2.0 foram desligados em jun/2026; use `gemini-3.5-flash` ou `gemini-2.5-flash` (ver [deprecations](https://ai.google.dev/gemini-api/docs/deprecations)).
- **401 no front** — Confirme `JWT_SECRET`, login e header `Authorization`.
