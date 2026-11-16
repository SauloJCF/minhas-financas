# Servidor MCP: só local, entrando como um usuário

O projeto tem um servidor MCP (`mcp/server.ts`) que oferece a clientes como o Claude Code ferramentas para consultar e criar lançamentos. Ele roda na máquina de desenvolvimento, por stdio, e só fala com o Supabase local: recusa iniciar se a URL não for `localhost` ou `127.0.0.1`. Entra com e-mail e senha pela chave `anon`, por padrão como o usuário de desenvolvimento do `supabase/seed.sql`, e nunca usa a chave `service_role`. Escolhemos assim porque o objetivo é aprender o protocolo sem pôr os dados de produção ao alcance de um modelo antes de existir um login de verdade.

Não contraria o ADR 0001: não é um backend do app. Nada é hospedado, o front não depende dele, e ele acessa o banco pelo mesmo caminho do front (`supabase-js` + RLS).

## Considered Options

- **Chave `service_role`**: dispensaria o login, mas ignora o RLS; um erro no servidor exporia os dados de todos os usuários.
- **Apontar para produção com a senha do usuário em um `.env`**: daria respostas sobre os dados reais, mas deixa uma senha de produção em arquivo e um modelo gravando no banco de verdade.
- **Servidor remoto (HTTP) com OAuth pelo Supabase Auth**: é o caminho para usar os dados reais, de qualquer cliente. Fica para uma fatia própria.

## Consequences

- O servidor responde sobre os dados do banco local, não sobre as finanças reais do usuário.
- `create_transaction` grava sem a tela de confirmação que o assistente do app tem (ADR 0008). Quem pede permissão antes de cada chamada é o cliente MCP; o servidor só marca as ferramentas de leitura com `readOnlyHint`.
- A conferência dos argumentos de `create_transaction` repete as regras de `src/assistant/proposal.ts`, porque aquele módulo depende de código do front. Uma regra nova de lançamento precisa entrar nos dois lugares.
- As ferramentas falam em reais com ponto decimal; a conversão para centavos fica no servidor.
