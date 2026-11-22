# Declaração de Diligência: Minhas Finanças

**Autor:** Saulo José Coelho de Figueiredo
**Data:** 22 de novembro de 2026
**Contexto:** Projeto pessoal, publicado como parte do meu portfólio profissional.

## 1. Sistemas de IA utilizados

- **Claude Code (Anthropic)**, no aplicativo desktop e na CLI, como principal ferramenta de programação em par. Os modelos usados foram **Claude Sonnet 5.5**, **Claude Opus 5.5** e **Claude Fable 5.2**. Os trailers dos commits creditam o Fable 5.2 em 23 commits, o Sonnet 5.5 em 19 e o Opus 5.5 em 2, de um total de 78 commits.
- **Claude Code GitHub Action** (`anthropics/claude-code-action`, modelo `claude-sonnet-5-5`), executada pelos workflows do próprio repositório para a triagem e a implementação de tickets. Ela commita como `claude[bot]` (2 commits).
- **Modelos do OpenRouter** são um recurso do produto, não uma ferramenta de desenvolvimento. O assistente do app que propõe lançamentos (ADR 0008) usa a chave do próprio usuário no OpenRouter, e nenhum modelo é fixado no código. Esses modelos não escreveram nenhuma parte do código do projeto.

## 2. Como a IA contribuiu

- **Código:** a IA redigiu boa parte da implementação, em fatias verticais tiradas do roteiro nas GitHub Issues: front-end em React/TypeScript, migrations do Supabase e políticas de row-level security, a Edge Function, o servidor MCP local e os workflows de CI e de deploy.
- **Testes:** a IA ajudou a escrever os testes unitários (Vitest) e os testes de banco e de RLS (pgTAP).
- **Documentação:** a IA ajudou a redigir o README, o glossário, os ADRs e as regras do agente.
- **Trabalho autônomo:** pelo sistema de tickets do app, um agente de IA faz a triagem das issues e abre pull requests em branches `claude/…`. Ele atua dentro de um escopo restrito, definido em `docs/agents/escopo-do-agente.md`.
- **Minha contribuição:** direção do produto, roteiro e recorte das fatias, as decisões de arquitetura (sem backend próprio, dados isolados por usuário, servidor MCP só local, chave do assistente com o usuário), testes manuais, aprovação de cada merge e publicação em produção.

## 3. Processo de revisão

- **Proteção da branch:** a `main` é protegida. Toda mudança passa por branch e pull request, e o merge exige o CI verde.
- **Verificações automáticas em todo PR:** lint, checagem de tipos, testes unitários, build de produção e testes pgTAP do banco e do row-level security.
- **Trava extra nos PRs do agente:** o `scripts/guard-claude-pr.ts` rejeita mudanças do agente em workflows, Edge Functions, dependências, autenticação, scripts, ADRs e regras do agente. Também rejeita SQL destrutivo ou que amplie privilégios (`DROP`, `TRUNCATE`, `DELETE`, `SECURITY DEFINER`, triggers e similares).
- **Testes manuais:** testei as mudanças à mão, no app rodando contra o Supabase local, antes de fazer o merge. As verificações automáticas pegam violações de regras e regressões, então os testes manuais são como confirmei que o comportamento financeiro está correto.
- **Ambientes seguros:** o desenvolvimento usa o Supabase local e nunca o banco de produção. O merge na `main` é o único caminho até a produção.

## 4. Responsabilidade

Assumo total responsabilidade pelo resultado final. Revisei, aceitei e fiz o merge de cada mudança deste repositório, inclusive das escritas ou coescritas por IA, e respondo pela correção, pela segurança e pelo licenciamento do projeto. As ferramentas de IA foram assistentes e não decidiram o que foi publicado.

## 5. Considerações de contexto

- **Uso em portfólio:** este projeto demonstra meu trabalho em design de produto, arquitetura e engenharia com apoio de IA. Como a IA escreveu uma parte grande do código, o que apresento como meu é o desenho, a direção, o teste e a revisão desse código.
- **Escopo:** é um controle financeiro pessoal e sem fins comerciais. Não é um produto financeiro regulado e não dá aconselhamento financeiro nem de investimentos.
- **Privacidade de dados:** o assistente do app envia o texto do usuário e os nomes de suas contas e categorias ao OpenRouter e ao provedor do modelo. A tela de Perfil informa isso (ADR 0008). O assistente apenas propõe lançamentos, e o usuário confirma cada um. O servidor MCP local recusa conectar-se a qualquer banco que não seja local (ADR 0009).
- **Segredos:** os agentes de IA não têm credenciais de produção, e os tokens têm escopo restrito (ver o README).
