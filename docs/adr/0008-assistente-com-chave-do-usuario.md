# Assistente: o navegador chama o OpenRouter com a chave do usuário, guardada no banco

O assistente usa modelos de IA do OpenRouter, e cada usuário informa a própria chave. A chave fica na tabela `assistant_settings`, uma linha por usuário, protegida por RLS (`user_id = auth.uid()`), e é o front que a lê e chama o OpenRouter direto do navegador. Escolhemos assim para manter o app sem servidor de aplicação (ADR 0001) e para a configuração valer em todos os aparelhos do usuário.

O modelo nunca grava: ele só chama a ferramenta `create_transaction`, que o app confere e mostra como uma proposta. O lançamento é criado pelo mesmo caminho do formulário, depois de o usuário confirmar.

## Considered Options

- **Chave só no `localStorage`**: nada de segredo no banco, mas a configuração teria de ser refeita em cada aparelho.
- **Chave no Supabase Vault, com uma Edge Function chamando o OpenRouter**: a chave nunca chegaria ao navegador, mas exige código de servidor para hospedar e manter, contra o ADR 0001.

## Consequences

- A chave não fica escondida do cliente: qualquer script que rode na página com a sessão do usuário consegue lê-la. O RLS protege a chave de um usuário dos outros usuários, não do próprio navegador.
- A chave fica em texto puro no banco de produção e entra nos backups. Quem tem acesso de administrador ao projeto Supabase consegue lê-la.
- O que o usuário escreve e os nomes das suas contas e categorias saem do app para o OpenRouter e para o provedor do modelo. O Perfil avisa isso.
- O custo e os limites de uso são da chave do usuário. O app não fixa modelo no código: a lista vem do OpenRouter, filtrada pelos modelos que aceitam ferramentas.
- Sem conexão o assistente não funciona (ADR 0005).
