# Tickets: a primeira Edge Function, para guardar o token do GitHub fora do navegador

Cada ticket vira uma issue pública no repositório, e a conversa volta para o app. Quem fala com o GitHub é a Edge Function `tickets`, do Supabase, autenticada pelo JWT do usuário. O token é um fine-grained PAT do administrador, restrito a este repositório (Issues: leitura e escrita; Pull requests: leitura), guardado como secret da função. Ele nunca chega ao navegador, ao banco ou a um log.

Isso cabe na exceção do ADR 0001 ("algo que exige código de servidor"): não há como o navegador abrir uma issue sem um token com escrita no repositório, e esse token não pode ir para o front.

O GitHub é a fonte da conversa. O banco guarda só a ligação ticket ↔ usuário ↔ issue (`tickets`, com RLS), e a função lê situação e mensagens da issue a cada pedido. A função grava a linha de `tickets` com o cliente do próprio usuário, para a RLS valer; as regras (limite de 3 tickets em andamento, situação, quem aparece na conversa) ficam em `supabase/functions/tickets/core.ts`, sem dependência de Deno e testadas pelo Vitest com um GitHub falso.

## Considered Options

- **Tabela de pedidos + workflow agendado no Actions**: o token ficaria só no GitHub, mas a issue só nasceria minutos depois, e a conversa seria difícil de sincronizar nos dois sentidos.
- **Gatilho com `pg_net` e o token no Vault**: sem código de servidor próprio, mas o token do GitHub ficaria dentro do banco, nos backups e ao alcance de quem lê o Vault.
- **GitHub App próprio**: permissões mais finas e comentários com identidade própria, mas é mais uma coisa para criar, instalar e manter.

## Consequences

- Os comentários enviados pelo app aparecem no GitHub com o login do administrador, porque saem com o PAT dele. A função grava um marcador invisível neles, e é por esse marcador (só vale em texto do administrador) que a conversa distingue o usuário do administrador. Uma conta qualquer do GitHub não consegue se passar por nenhum dos dois.
- Na conversa aparecem: o corpo da issue e os comentários do app (usuário), os comentários do administrador feitos no GitHub (exceto os que começam com `[interno]`) e, do agente, só o trecho entre `<!-- resposta-ao-usuario -->` e `<!-- /resposta-ao-usuario -->`. Comentários de qualquer outra pessoa ficam só no GitHub.
- A issue é anônima (sem nome nem e-mail) e pública. A tela de abrir ticket avisa para não incluir valores nem dados pessoais.
- A função faz uma ou duas chamadas ao GitHub por ticket a cada leitura, e o limite do PAT (5.000 requisições por hora) cobre com folga um app de poucos usuários.
- Depende do GitHub: sem ele (ou sem o token configurado, como no ambiente local), a tela mostra erro, e abrir e responder tickets não funciona. O resto do app não é afetado.
- O PAT é de uma pessoa e expira: renová-lo e atualizar o secret é uma tarefa recorrente do administrador.
- Em desenvolvimento, a função só chama o GitHub se um repositório descartável estiver configurado por variável de ambiente; nunca este repositório.
