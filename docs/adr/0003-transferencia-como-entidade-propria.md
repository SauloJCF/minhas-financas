# Transferência é uma entidade própria, não um par de lançamentos

Uma transferência entre contas é uma única linha (conta de origem, conta de destino, valor, data), e não uma despesa na origem ligada a uma receita no destino. Assim ela é atômica por natureza, sem precisar de função para manter um par consistente, e não infla os totais de receita e despesa nos relatórios.

## Considered Options

- **Par de lançamentos ligados** (despesa + receita): o extrato vira uma consulta só, mas todo relatório precisa lembrar de excluir os pares, e apagar ou editar uma metade deixa o par inconsistente.

## Consequences

- O saldo de uma conta soma duas fontes: lançamentos pagos e transferências.
- O extrato de uma conta precisa unir lançamentos e transferências.
- Transferências não têm categoria nem estado pendente.
