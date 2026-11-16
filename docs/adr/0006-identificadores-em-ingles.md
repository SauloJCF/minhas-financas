# Identificadores em inglês; português só na interface e na conversa

Tabelas, colunas, tipos, funções e nomes no código ficam em inglês (`accounts`, `categories`, `transactions`, `due_date`, `paid_at`). O português do `GLOSSARY.md` vale para tudo o que uma pessoa lê: a interface, as rotas (`/contas`), as mensagens, as issues e os comentários. Cada termo do glossário tem um único identificador correspondente: Conta é `account`, Categoria é `category`, Lançamento é `transaction`, Transferência é `transfer`, Receita é `income`, Despesa é `expense`, Vencimento é `due_date`, Pagamento é `paid_at`.

A fatia 3 chegou a criar a tabela `contas` em português; a fatia 4 a renomeou para `accounts` para seguir esta regra antes que mais tabelas dependessem dela.

## Consequences

- Os valores do tipo de conta (`corrente`, `poupanca`, `dinheiro`, `cartao`, `investimento`) ficaram em português: já estavam gravados em produção e não aparecem em nenhum outro identificador.
- Quem lê o código precisa do glossário ao lado para ligar `transaction` a "lançamento". Um identificador novo para um termo do glossário entra na lista acima.
