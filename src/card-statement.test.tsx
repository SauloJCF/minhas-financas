import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cardStatementPeriod, openStatementMonth } from '@/accounts/card-statement'
import { db } from '@/test/fake-supabase'
import { brl, renderAt } from '@/test/render'

vi.mock('@/lib/supabase', () => import('@/test/fake-supabase'))

function transaction(overrides: Record<string, unknown>) {
  return {
    id: 'transaction-x',
    type: 'expense',
    description: 'Compra',
    amount: 1000,
    account_id: 'card',
    category_id: 'food',
    due_date: '2026-11-01',
    paid_at: null,
    notes: null,
    group_id: null,
    installment_number: null,
    created_at: '0',
    ...overrides,
  }
}

beforeEach(() => {
  // Só o relógio: hoje é 16/11/2026.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 16, 12))

  db.reset()
  db.tables.accounts = [
    { id: 'nubank', name: 'Nubank', type: 'corrente', initial_balance: 500000, initial_balance_date: '2026-01-01', color: '#9333ea', icon: 'landmark', archived: false, closing_day: null, due_day: null },
    { id: 'card', name: 'Cartão Inter', type: 'cartao', initial_balance: 0, initial_balance_date: '2026-01-01', color: '#ea580c', icon: 'credit-card', archived: false, closing_day: 10, due_day: 17 },
  ]
  db.tables.categories = [
    { id: 'food', name: 'Alimentação', type: 'expense', color: '#ea580c', icon: 'utensils', archived: false },
    { id: 'refund', name: 'Outros', type: 'income', color: '#475569', icon: 'ellipsis', archived: false },
  ]
})

afterEach(() => vi.useRealTimers())

test('o ciclo vai do fechamento anterior à véspera do fechamento; o vencimento vem depois', () => {
  expect(cardStatementPeriod('2026-11', 10, 17)).toEqual({
    start: '2026-10-10',
    end: '2026-11-09',
    closingDate: '2026-11-10',
    dueDate: '2026-11-17',
  })
  // Vencimento antes do fechamento no calendário: é no mês seguinte.
  expect(cardStatementPeriod('2026-11', 25, 5).dueDate).toBe('2026-12-05')
})

test('dias 29 a 31 caem no último dia dos meses curtos, sem deixar buraco entre faturas', () => {
  expect(cardStatementPeriod('2027-02', 31, 10)).toMatchObject({ start: '2027-01-31', end: '2027-02-27', closingDate: '2027-02-28' })
  expect(cardStatementPeriod('2027-03', 31, 10)).toMatchObject({ start: '2027-02-28', end: '2027-03-30' })
})

test('a fatura aberta é a que recebe a compra do dia: no dia do fechamento já é a seguinte', () => {
  expect(openStatementMonth('2026-11-09', 10)).toBe('2026-11')
  expect(openStatementMonth('2026-11-10', 10)).toBe('2026-12')
  expect(openStatementMonth('2026-12-31', 10)).toBe('2027-01')
})

test('a fatura lista os lançamentos do ciclo; a compra do dia do fechamento fica na seguinte', async () => {
  db.tables.transaction_series = [
    { id: 'tv', kind: 'installment', frequency: 'monthly', start_date: '2026-10-20', installment_count: 3 },
  ]
  db.tables.transactions = [
    transaction({ id: 'a', description: 'Mercado', amount: 20000, due_date: '2026-11-09', paid_at: '2026-11-09' }),
    transaction({ id: 'b', description: 'Farmácia', amount: 7000, due_date: '2026-11-10', paid_at: '2026-11-10' }),
    transaction({ id: 'c', description: 'Estorno', type: 'income', amount: 5000, category_id: 'refund', due_date: '2026-10-25', paid_at: '2026-10-25' }),
    transaction({ id: 'tv-1', description: 'Televisão', amount: 30000, due_date: '2026-10-20', paid_at: '2026-10-20', group_id: 'tv', installment_number: 1 }),
    transaction({ id: 'tv-2', description: 'Televisão', amount: 30000, due_date: '2026-11-20', group_id: 'tv', installment_number: 2 }),
    transaction({ id: 'tv-3', description: 'Televisão', amount: 30000, due_date: '2026-12-20', group_id: 'tv', installment_number: 3 }),
    transaction({ id: 'other', description: 'Da conta corrente', account_id: 'nubank', due_date: '2026-11-01' }),
  ]
  const user = renderAt('/contas/card')
  await user.click(await screen.findByRole('link', { name: 'Fatura' }))

  // Hoje é dia 16: a fatura de novembro fechou no dia 10, a aberta é a de dezembro.
  expect(await screen.findByRole('heading', { name: 'dezembro de 2026' })).toBeInTheDocument()
  const list = await screen.findByRole('list', { name: 'Lançamentos da fatura' })
  const items = () => within(screen.getByRole('list', { name: 'Lançamentos da fatura' })).getAllByRole('link').map((link) => link.textContent)
  expect(within(list).getByRole('link', { name: /Farmácia/ })).toBeInTheDocument()
  expect(await within(list).findByRole('link', { name: /Televisão \(2\/3\)/ })).toHaveTextContent('Pendente')
  expect(items()).toHaveLength(2)
  expect(screen.getByText('Total da fatura').nextElementSibling).toHaveTextContent(brl(37000))
  expect(screen.getByText(/Fecha em 10\/12, vence em 17\/12/)).toBeInTheDocument()
  expect(screen.getByText(/Esta fatura ainda está aberta/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /^Pagar/ })).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Mês anterior' }))
  expect(await screen.findByRole('heading', { name: 'novembro de 2026' })).toBeInTheDocument()
  expect(await screen.findByRole('link', { name: /Mercado/ })).toBeInTheDocument()
  expect(items()).toHaveLength(3)
  // 200,00 + 300,00 - 50,00 de estorno.
  expect(screen.getByText('Total da fatura').nextElementSibling).toHaveTextContent(brl(45000))
  expect(screen.getByText('Compras de 10/10/2026 a 09/11/2026.')).toBeInTheDocument()
})

test('pagar a fatura marca os pendentes como pagos e transfere o total para o cartão', async () => {
  db.tables.transactions = [
    transaction({ id: 'a', description: 'Mercado', amount: 20000, due_date: '2026-10-15', paid_at: '2026-10-15' }),
    transaction({ id: 'b', description: 'Parcela', amount: 30000, due_date: '2026-11-05' }),
    transaction({ id: 'c', description: 'Próxima', amount: 9000, due_date: '2026-11-12' }),
  ]
  const user = renderAt('/contas/card/fatura?mes=2026-11')

  expect(await screen.findByText(/Fechou em 10\/11, vence em 17\/11/)).toBeInTheDocument()
  const pay = await screen.findByRole('button', { name: /^Pagar R\$\s500,00$/ })
  // Só há uma conta de onde pagar: ela já vem escolhida.
  expect(screen.getByLabelText('Pagar com')).toHaveDisplayValue('Nubank')
  expect(screen.getByLabelText('Data do pagamento')).toHaveValue('2026-11-16')
  await user.click(pay)

  // Volta para o extrato do cartão, com a transferência.
  expect(await screen.findByRole('link', { name: /Transferência de Nubank/ })).toHaveTextContent(`+${brl(50000)}`)
  expect(db.tables.transfers).toMatchObject([
    { from_account_id: 'nubank', to_account_id: 'card', amount: 50000, date: '2026-11-16' },
  ])
  expect(db.tables.transactions.map((item) => item.paid_at)).toEqual(['2026-10-15', '2026-11-05', null])
})

test('pendente em cartão não é vencido: aparece como "Na fatura" e fica fora dos pendentes do início', async () => {
  db.tables.transactions = [
    transaction({ id: 'a', description: 'Parcela do cartão', due_date: '2026-11-05' }),
    transaction({ id: 'b', description: 'Boleto atrasado', account_id: 'nubank', due_date: '2026-11-05' }),
  ]
  const user = renderAt('/lancamentos')
  const row = (name: RegExp) => screen.getByRole('link', { name }).closest('li')!

  await screen.findByRole('link', { name: /Parcela do cartão/ })
  expect(row(/Parcela do cartão/)).toHaveTextContent('Na fatura')
  expect(row(/Boleto atrasado/)).toHaveTextContent('Vencido')

  await user.selectOptions(screen.getByLabelText('Filtrar por estado'), 'Vencidos')
  expect(screen.queryByRole('link', { name: /Parcela do cartão/ })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Boleto atrasado/ })).toBeInTheDocument()

  await user.click(within(screen.getByRole('navigation', { name: 'Principal' })).getByRole('link', { name: 'Início' }))
  const pending = await screen.findByRole('list', { name: 'Pendentes e vencidos' })
  expect(within(pending).getByRole('link', { name: /Boleto atrasado/ })).toBeInTheDocument()
  expect(within(pending).queryByRole('link', { name: /Parcela do cartão/ })).not.toBeInTheDocument()
})

test('a conta cartão guarda fechamento e vencimento; outros tipos não têm esses campos', async () => {
  const user = renderAt('/contas/nova')
  await user.type(await screen.findByLabelText('Nome'), 'Cartão novo')
  expect(screen.queryByLabelText('Dia de fechamento')).not.toBeInTheDocument()

  await user.selectOptions(screen.getByLabelText('Tipo de conta'), 'Cartão')
  await user.type(screen.getByLabelText('Dia de fechamento'), '40')
  await user.type(screen.getByLabelText('Dia de vencimento'), '5')
  await user.click(screen.getByRole('button', { name: 'Criar conta' }))
  expect(await screen.findByText('Informe um dia de 1 a 31.')).toBeInTheDocument()

  await user.clear(screen.getByLabelText('Dia de fechamento'))
  await user.type(screen.getByLabelText('Dia de fechamento'), '28')
  await user.click(screen.getByRole('button', { name: 'Criar conta' }))

  expect(await screen.findByRole('link', { name: /Cartão novo/ })).toBeInTheDocument()
  expect(db.tables.accounts.at(-1)).toMatchObject({ name: 'Cartão novo', type: 'cartao', closing_day: 28, due_day: 5 })
})

test('cartão sem os dias do ciclo não tem fatura e explica o porquê', async () => {
  db.tables.accounts[1].closing_day = null
  db.tables.accounts[1].due_day = null
  renderAt('/contas/card')
  expect(await screen.findByText(/informe os dias de fechamento e de vencimento na edição da conta/)).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Fatura' })).not.toBeInTheDocument()
})

test('compra nova no cartão já nasce paga na data da compra', async () => {
  const user = renderAt('/lancamentos/novo')
  await user.type(await screen.findByLabelText('Descrição'), 'Restaurante')
  await user.type(screen.getByLabelText('Valor (R$)'), '80')
  await user.selectOptions(screen.getByLabelText('Categoria'), 'Alimentação')
  expect(screen.getByRole('checkbox', { name: 'Pago' })).not.toBeChecked()

  await user.selectOptions(screen.getByLabelText('Conta'), 'Cartão Inter')
  expect(screen.getByRole('checkbox', { name: 'Pago' })).toBeChecked()
  await user.clear(screen.getByLabelText('Vencimento'))
  await user.type(screen.getByLabelText('Vencimento'), '2026-11-14')
  await user.click(screen.getByRole('button', { name: 'Criar lançamento' }))

  await screen.findByRole('link', { name: /Restaurante/ })
  expect(db.tables.transactions[0]).toMatchObject({ account_id: 'card', due_date: '2026-11-14', paid_at: '2026-11-14' })
})
