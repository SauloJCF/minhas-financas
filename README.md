# Minhas Finanças

App pessoal de controle financeiro. PWA em React + Vite + TypeScript, com Supabase
(Postgres, Auth, RLS) como backend e publicação em Cloudflare Workers (assets estáticos).
Tudo dentro dos planos gratuitos.

## Desenvolvimento

Requisitos: Node 24, Git e Docker Desktop (para o Supabase local).

```bash
npm install
npm run db:start        # sobe o Supabase local (Docker precisa estar aberto)
cp .env.example .env.local   # preencha a anon key mostrada por `npx supabase status`
npm run dev
```

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

## CI/CD

- **Pull request**: `.github/workflows/ci.yml` roda lint, tipos, testes e build.
- **Push na `main`**: `.github/workflows/deploy.yml` roda o CI, aplica as migrations
  no Supabase e só então publica o front na Cloudflare.

## Configuração inicial (uma vez)

### 1. Supabase

1. Crie um projeto em <https://supabase.com/dashboard> (região `South America (São Paulo)`).
   Guarde a **senha do banco** escolhida na criação.
2. Em **Authentication > Sign In / Providers**, desligue **Allow new users to sign up**.
   A partir daí, só entra quem for convidado em **Authentication > Users > Invite user**.
3. Anote, em **Project Settings**: o **Project ID**, a **Project URL** e a chave **anon/publishable**.
4. Crie um token pessoal em <https://supabase.com/dashboard/account/tokens>.

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
| Variable | `SUPABASE_PROJECT_ID` | Project ID do Supabase |
| Variable | `VITE_SUPABASE_URL` | Project URL do Supabase |
| Variable | `VITE_SUPABASE_ANON_KEY` | chave anon/publishable |

A chave anon é pública por desenho (vai embutida no front); quem protege os dados é o RLS.
As outras quatro são segredos e nunca entram no repositório.

Em **Settings > Branches**, proteja a `main` exigindo o check **Lint, tipos, testes e build**.

Depois do primeiro push na `main`, o app fica em
`https://minhas-financas.<seu-subdominio>.workers.dev`. No Android, abra no Chrome e use
**Adicionar à tela inicial / Instalar app**.
