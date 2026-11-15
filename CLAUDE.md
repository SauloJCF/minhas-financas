# Minhas Finanças

App pessoal de controle financeiro: PWA em React + Vite + TypeScript, Supabase como backend, publicado em Cloudflare Workers. Como rodar e como o pipeline funciona estão no `README.md`.

## Roteiro

O trabalho é feito em fatias verticais, uma por vez. O roteiro vive nas GitHub Issues: a issue "Roteiro da fase 1" (#5) lista as fatias como sub-issues, e a próxima fatia é a primeira sub-issue aberta. Cada issue de fatia traz o escopo e as decisões já tomadas; leia-a antes de começar.

```bash
gh issue view 5 --json title,body,subIssues
```

## Fluxo de trabalho

- A `main` é protegida: toda mudança vai por branch e pull request, com o CI verde.
- O merge na `main` aplica as migrations no Supabase de produção e publica o front.
- Desenvolvimento usa o Supabase local (`npm run db:start`, precisa do Docker aberto), nunca o banco de produção.
- Ao concluir uma fatia, feche a issue correspondente pelo pull request (`Closes #N`).

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default triage labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` at the repo root and ADRs in `docs/adr/`. See `docs/agents/domain.md`.
