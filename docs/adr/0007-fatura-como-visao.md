# Fatura de cartão é uma visão, não uma entidade

A fatura de um cartão não tem tabela. A conta cartão guarda só o dia de fechamento e o dia de vencimento; a fatura de um mês é o conjunto dos lançamentos dessa conta cujo vencimento cai no ciclo de fechamento, calculado no app. Uma compra no cartão é um lançamento pago na data da compra, as parcelas futuras são lançamentos pendentes, e pagar a fatura é uma transferência comum de outra conta para o cartão (ADR 0003). Assim o modelo da fase 1 não muda: o saldo do cartão continua sendo a dívida, sem uma segunda fonte de verdade para manter em dia.

## Considered Options

- **Tabela de faturas**, com estado (aberta, fechada, paga) e os lançamentos apontando para ela: permite pagamento parcial e saber com certeza se uma fatura foi paga, mas exige fechar faturas em um momento certo, o que pede um processo no servidor que o app não tem (ADR 0001), e obriga a realocar lançamentos sempre que uma data ou os dias do ciclo mudam.

## Consequences

- Mudar o dia de fechamento da conta muda retroativamente a que fatura cada lançamento pertence.
- O app não sabe dizer se uma fatura foi paga: não há vínculo gravado entre a transferência e a fatura. Quem responde isso é o saldo do cartão.
- Pagamento parcial, juros e encargos não têm lugar no modelo; entram como lançamentos comuns, se o usuário quiser registrá-los.
- Lançamento pendente em conta cartão não é tratado como vencido: quem o cobra é a fatura. Pagar a fatura é o que o marca como pago.
