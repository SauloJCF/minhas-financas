# Minhas Finanças

App pessoal de controle financeiro. PWA em React + Vite + TypeScript, com Supabase
(Postgres, Auth, RLS) como backend e publicação em Cloudflare Workers (assets estáticos).
Tudo dentro dos planos gratuitos.

## Desenvolvimento

Requisitos: Node 24, Git e Docker Desktop (para o Supabase local).

```bash
npm install
npm run db:start        # sobe o Supabase local (Docker precisa estar aberto)
cp .env.example .env.development.local   # preencha a anon key mostrada por `npx supabase status`
npm run dev
```

`npm run dev` lê `.env.development.local` e fala com o Supabase **local**. Os e-mails de
convite e de recuperação enviados em desenvolvimento não saem da máquina: aparecem na caixa
de entrada falsa em <http://127.0.0.1:54324>.

O banco local já nasce com um usuário de desenvolvimento, criado por `supabase/seed.sql`
(o e-mail e a senha estão lá) e recriado a cada `npm run db:reset`. Para convidar outro, use
**Authentication > Users > Invite user** no Studio local (<http://127.0.0.1:54323>).

Mudou o schema? Crie a migration em `supabase/migrations/`, rode `npm run db:reset`,
`npm run db:test` e `npm run db:types`, e inclua `src/lib/database.types.ts` no commit.

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run lint` | Lint (oxlint) |
| `npm run typecheck` | Checagem de tipos |
| `npm test` | Testes (Vitest) |
| `npm run build` | Build de produção em `dist/` |
| `npm run preview` | Serve o build, com service worker |
| `npm run db:reset` | Recria o banco local aplicando as migrations |
| `npm run db:test` | Testes de banco/RLS (pgTAP) |
| `npm run db:types` | Gera os tipos TypeScript a partir do schema local |
| `npm run mcp` | Servidor MCP local (ver abaixo) |

### Offline

O app instalado abre sem rede e mostra os dados que já tinha carregado, guardados no
IndexedDB por até 7 dias. Uma faixa avisa de quando são os dados. Salvar, pagar e excluir
precisam de conexão (ADR 0010). Para testar, rode `npm run build && npm run preview`, abra o
app, navegue pelas telas e marque "Offline" na aba Network do DevTools.

### Tickets (Edge Function)

Os tickets abertos pelo app viram issues deste repositório, por meio da Edge Function
`supabase/functions/tickets` (ADR 0011). Sem os secrets abaixo, a função local responde
"A integração com o GitHub não está configurada" e não chama o GitHub.

Para testar de ponta a ponta, **use um repositório descartável seu, nunca este**:

1. Crie um repositório vazio (por exemplo `minhas-financas-sandbox`), com os labels `ticket`,
   `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`, `bug` e
   `enhancement`.
2. Crie um PAT fino só para ele (ver "Token do GitHub" abaixo) e ponha em
   `supabase/functions/.env` (já ignorado pelo git):

   ```
   GH_TICKETS_TOKEN=github_pat_...
   GH_TICKETS_REPO=seu-usuario/minhas-financas-sandbox
   ```
3. Rode `npx supabase functions serve --env-file supabase/functions/.env` com `npm run dev` aberto.

Variáveis opcionais: `GH_TICKETS_ADMIN` (login do administrador; padrão: o dono do repositório)
e `GH_TICKETS_AGENTS` (logins do agente, separados por vírgula; padrão
`claude[bot],github-actions[bot]`). A lógica da função está em `supabase/functions/tickets/core.ts`
e é testada por `npm test`, sem chamar o GitHub.

### Servidor MCP local

`mcp/server.ts` é um servidor [MCP](https://modelcontextprotocol.io) que deixa um cliente
como o Claude Code consultar e criar lançamentos no Supabase **local**. Ele entra como o
usuário de desenvolvimento, pela chave `anon`, então o RLS vale como no front; e recusa
iniciar se a URL do Supabase não for da própria máquina (ADR 0009).

| Ferramenta | O que faz |
| --- | --- |
| `list_accounts` | Contas não arquivadas, com saldo atual e previsto |
| `list_categories` | Categorias não arquivadas |
| `list_transactions` | Lançamentos de um período, com filtros |
| `month_summary` | Receitas, despesas e resultado de um mês, e despesas por categoria |
| `create_transaction` | Cria um lançamento |

- **Claude Code**: o `.mcp.json` da raiz já registra o servidor. Ao abrir o projeto, aprove o
  servidor `minhas-financas`; com o Supabase local no ar, as ferramentas aparecem em `/mcp`.
- **À mão**: `npm run mcp` inicia o servidor, que fica esperando um cliente em stdin/stdout.
  Para chamar as ferramentas por uma interface, use o MCP Inspector:
  `npx @modelcontextprotocol/inspector -- node --env-file-if-exists=.env.development.local mcp/server.ts`.
- **Outro usuário**: defina `MCP_USER_EMAIL` e `MCP_USER_PASSWORD` em `.env.development.local`.

O servidor roda direto pelo Node, sem build. A lógica que não depende do banco fica em
`mcp/tools.ts` e é testada por `npm test`.

## CI/CD

- **Pull request**: `.github/workflows/ci.yml` roda lint, tipos, testes e build, e os testes
  de banco/RLS (pgTAP) em um Postgres local do próprio CI.
- **Push na `main`**: `.github/workflows/deploy.yml` roda o CI, aplica as migrations
  no Supabase e só então publica o front na Cloudflare.

## Configuração inicial (uma vez)

### 1. Supabase

1. Crie um projeto em <https://supabase.com/dashboard> (região `South America (São Paulo)`).
   Guarde a **senha do banco** escolhida na criação.
2. Em **Authentication > Sign In / Providers**, desligue **Allow new users to sign up**.
   A partir daí, só entra quem for convidado em **Authentication > Users > Invite user**.
   Na mesma área, em **Email > Minimum password length**, use 8.
3. Em **Authentication > URL Configuration**, ponha em **Site URL** o endereço publicado
   (`https://minhas-financas.<seu-subdominio>.workers.dev`). Os links dos e-mails usam esse valor.
4. Os e-mails de convite e de recuperação usam o modelo padrão do Supabase (em inglês): no
   plano gratuito, personalizá-los exige SMTP próprio. O app entende o link padrão. Se um dia
   configurar SMTP, cole em **Authentication > Emails** os modelos de `supabase/templates/`.
5. Anote, em **Project Settings**: o **Project ID**, a **Project URL** e a chave **anon/publishable**.
6. Crie um token pessoal em <https://supabase.com/dashboard/account/tokens>.

### 2. Cloudflare

1. Crie uma conta em <https://dash.cloudflare.com> e anote o **Account ID**
   (em Workers & Pages, na lateral).
2. Em **Workers & Pages**, escolha o seu subdomínio `*.workers.dev` se ainda não tiver.
3. Em **Manage Account > Account API Tokens > Create Token**, use o modelo
   **Edit Cloudflare Workers**, restrito à sua conta.

### 3. GitHub

Crie o repositório e, em **Settings > Secrets and variables > Actions**, cadastre:

| Tipo | Nome | Valor |
| --- | --- | --- |
| Secret | `SUPABASE_ACCESS_TOKEN` | token pessoal do Supabase |
| Secret | `SUPABASE_DB_PASSWORD` | senha do banco |
| Secret | `CLOUDFLARE_API_TOKEN` | token da Cloudflare |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | Account ID da Cloudflare |
| Secret | `TICKETS_GITHUB_TOKEN` | PAT fino do GitHub, para os tickets (ver abaixo) |
| Variable | `SUPABASE_PROJECT_ID` | Project ID do Supabase |
| Variable | `VITE_SUPABASE_URL` | Project URL do Supabase |
| Variable | `VITE_SUPABASE_ANON_KEY` | chave anon/publishable |

A chave anon é pública por desenho (vai embutida no front); quem protege os dados é o RLS.
As outras quatro são segredos e nunca entram no repositório.

#### Token do GitHub (tickets)

Para os tickets funcionarem em produção, o administrador cria um PAT e o cadastra como secret:

1. Em <https://github.com/settings/personal-access-tokens/new> (fine-grained token), escolha
   **Only select repositories** e marque só este repositório.
2. Em **Repository permissions**, dê **Issues: Read and write** e **Pull requests: Read-only**
   (o resto fica sem acesso). Defina a validade; ao expirar, crie outro e atualize o secret.
3. Cadastre o valor em **Settings > Secrets and variables > Actions** com o nome
   `TICKETS_GITHUB_TOKEN`. A cada deploy, o `deploy.yml` o copia para o secret
   `GH_TICKETS_TOKEN` da função no Supabase (junto com `GH_TICKETS_REPO`, o próprio repositório).
4. Confira que os labels `ticket`, `needs-triage`, `needs-info`, `ready-for-agent`,
   `ready-for-human`, `wontfix`, `bug` e `enhancement` existem no repositório. O `ticket` precisa
   ser criado à mão.

O token nunca vai para o front, para o banco nem para um log.

Em **Settings > Branches**, proteja a `main` exigindo o check **Lint, tipos, testes e build**.

Depois do primeiro push na `main`, o app fica em
`https://minhas-financas.<seu-subdominio>.workers.dev`. No Android, abra no Chrome e use
**Adicionar à tela inicial / Instalar app**.
