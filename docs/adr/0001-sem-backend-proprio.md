# Sem backend próprio: o front fala direto com o Postgres

O app não tem servidor de aplicação. O front (SPA estática na Cloudflare) acessa o Postgres do Supabase diretamente pelo `supabase-js`, e a autorização é feita inteiramente por RLS (`user_id = auth.uid()`). Operações que precisam ser atômicas viram funções SQL chamadas por RPC; Edge Functions só entram se algo realmente exigir código de servidor. Escolhemos assim porque o objetivo é aprendizado dentro dos planos gratuitos, e um backend próprio seria mais um serviço para hospedar e manter.

## Consequences

- O RLS é a única barreira entre um usuário e os dados de outro. Toda tabela nova precisa de políticas e de testes de RLS (pgTAP); validação feita só no front não protege nada.
- A chave `anon` vai embutida no front e é pública por desenho.
- Regras de negócio moram no banco (constraints, views, funções), não em uma camada de serviço.
