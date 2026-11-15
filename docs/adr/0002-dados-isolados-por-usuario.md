# Dados isolados por usuário, sem compartilhamento

Cada linha pertence a exatamente um usuário e só ele a enxerga. Não existe o conceito de "lar" ou grupo: duas pessoas convidadas (um casal, por exemplo) têm finanças totalmente separadas. Decidimos assim para manter o RLS em uma única regra simples; compartilhamento exigiria uma entidade de grupo, papéis e políticas diferentes em todas as tabelas.

## Consequences

Adicionar compartilhamento depois não é um ajuste: muda a chave de propriedade de todas as tabelas (de `user_id` para o grupo) e reescreve todas as políticas de RLS.
