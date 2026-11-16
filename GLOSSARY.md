# Minhas Finanças

Controle financeiro pessoal: cada usuário registra onde seu dinheiro está, o que entrou, o que saiu e o que ainda vai entrar ou sair.

## Language

### Acesso

**Usuário**:
Pessoa com acesso ao app. Tudo o que registra pertence só a ela e não é visto por nenhum outro usuário.
_Avoid_: Conta (de acesso), cliente

**Perfil**:
Os dados de acesso do próprio usuário: seu e-mail e sua senha.
_Avoid_: Conta, minha conta, configurações

**Convite**:
Única forma de alguém se tornar usuário: um e-mail enviado pelo administrador, com um link para criar a senha.
_Avoid_: Cadastro, registro, inscrição

### Onde o dinheiro está

**Conta**:
Lugar onde o usuário guarda ou deve dinheiro, como uma conta corrente, a carteira ou um cartão de crédito.
_Avoid_: Carteira (como sinônimo geral), banco, conta bancária

**Tipo de conta**:
Classificação de uma conta: corrente, poupança, dinheiro, cartão ou investimento. Serve para agrupar e exibir.

**Saldo inicial**:
Quanto havia na conta na data em que o usuário começou a registrá-la no app.
_Avoid_: Saldo de abertura

**Saldo atual**:
Quanto há na conta agora: o saldo inicial mais tudo o que já foi pago e transferido.
_Avoid_: Saldo real, saldo disponível

**Saldo previsto**:
Quanto haverá na conta se todos os lançamentos pendentes forem pagos.
_Avoid_: Saldo projetado, saldo futuro

**Conta arquivada**:
Conta que o usuário não usa mais: deixa de ser oferecida para novos registros, mas seu histórico continua existindo.
_Avoid_: Conta excluída, conta inativa, conta fechada

### O que entra e o que sai

**Lançamento**:
Um valor que entra ou sai de uma conta, com vencimento e categoria. Todo lançamento é uma receita ou uma despesa.
_Avoid_: Transação, movimentação, registro

**Receita**:
Lançamento de dinheiro que entra em uma conta.
_Avoid_: Entrada, ganho, crédito

**Despesa**:
Lançamento de dinheiro que sai de uma conta.
_Avoid_: Saída, gasto, débito

**Categoria**:
Classificação de um lançamento pelo motivo, como Alimentação ou Salário. Cada categoria é de receita ou de despesa, nunca das duas.
_Avoid_: Tipo, grupo, etiqueta, tag

**Categoria arquivada**:
Categoria que deixa de ser oferecida para novos lançamentos, mas continua nos que já a usam.

**Vencimento**:
Data em que um lançamento deve ser pago ou recebido.
_Avoid_: Data prevista, data do lançamento

**Pagamento**:
Data em que um lançamento foi de fato pago ou recebido. Vale tanto para despesas quanto para receitas.
_Avoid_: Recebimento, quitação, baixa, efetivação

**Pago**:
Lançamento que tem pagamento. Só lançamentos pagos alteram o saldo atual.
_Avoid_: Recebido, quitado, efetivado, realizado

**Pendente**:
Lançamento que ainda não tem pagamento.
_Avoid_: Em aberto, previsto, a pagar, a receber

**Vencido**:
Lançamento pendente cujo vencimento já passou.
_Avoid_: Atrasado, em atraso

### Orçamento

**Orçamento**:
O conjunto dos limites mensais do usuário, um por categoria de despesa. Vale para todos os meses até ser alterado.
_Avoid_: Meta, planejamento, teto de gastos

**Limite mensal**:
Quanto o usuário pretende gastar por mês em uma categoria de despesa.
_Avoid_: Orçado, verba, cota

**Consumo**:
Quanto do limite de uma categoria já foi usado em um mês: a soma das despesas pagas e pendentes com vencimento naquele mês.
_Avoid_: Gasto realizado, utilização

### O que se repete

**Série**:
Conjunto de lançamentos criados juntos e ligados entre si: uma recorrência ou um parcelamento. Cada lançamento da série continua sendo um lançamento comum.
_Avoid_: Grupo, lote, repetição

**Recorrência**:
Série de lançamentos iguais que se repetem sem data para acabar, como aluguel ou salário. Nasce com 12 ocorrências e pode ser estendida.
_Avoid_: Lançamento fixo, despesa fixa, assinatura

**Parcelamento**:
Série que divide um valor total em parcelas mensais, com um número fixo de parcelas.
_Avoid_: Compra parcelada, financiamento, crediário

**Parcela**:
Cada lançamento de um parcelamento, identificado pela posição e pelo total, como "3/10".
_Avoid_: Prestação, mensalidade

**Ocorrência**:
Cada lançamento de uma recorrência.
_Avoid_: Repetição, instância

**Frequência**:
De quanto em quanto tempo uma recorrência se repete: semanal, mensal ou anual.
_Avoid_: Periodicidade, intervalo

**Estender**:
Gerar mais 12 ocorrências de uma recorrência, a partir da última.
_Avoid_: Renovar, prorrogar

### Cartão de crédito

**Fatura**:
Os lançamentos de uma conta cartão cujo vencimento cai em um ciclo de fechamento. Não é um registro próprio: é uma forma de ver os lançamentos do cartão.
_Avoid_: Boleto, conta do cartão, extrato do cartão

**Fechamento**:
Dia do mês em que a fatura deixa de receber compras. Uma compra feita no dia do fechamento já é da fatura seguinte.
_Avoid_: Corte, virada, melhor dia de compra

**Vencimento da fatura**:
Dia do mês em que a fatura deve ser paga.
_Avoid_: Data de pagamento

**Fatura aberta**:
Fatura que ainda não chegou ao fechamento e continua recebendo compras.
_Avoid_: Fatura atual, fatura parcial

**Fatura fechada**:
Fatura que já passou do fechamento e pode ser paga.

**Pagar a fatura**:
Marcar como pagos os lançamentos pendentes da fatura e transferir o total dela de outra conta para o cartão.
_Avoid_: Quitar, liquidar

### Entre contas

**Transferência**:
Movimento de um valor de uma conta para outra do mesmo usuário. Não é receita nem despesa e não tem estado pendente.
_Avoid_: Lançamento de transferência, movimentação entre contas
