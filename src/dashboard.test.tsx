import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { db } from '@/test/fake-supabase'
import { brl, renderAt } from '@/test/render'

vi.mock('@/lib/supabase', () => import('@/test/fake-supabase'))

const account = (id: string, name: string, initial_balance: number, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  type: 'corrente',
  initial_balance,
  initial_balance_date: '2026-11-01',
  color: '#059669',
  icon: 'landmark',
  archived: false,
  ...extra,
})

const transaction = (id: string, overrides: Record<string, unknown>) => ({
  id,
  type: 'expense',
  description: id,
  amount: 1000,
  account_id: 'nubank',
  category_id: 'food',
  due_date: '2026-11-10',
  paid_at: null,
  notes: null,
  created_at: id,
  ...overrides,
})

beforeEach(() => {
  // Só o relógio: hoje é 16/11/2026.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 16, 12))

  db.reset()
  db.tables.accounts = [
    account('nubank', 'Nubank', 100000),
    account('wallet', 'Carteira', 5000, { type: 'dinheiro' }),
    account('old', 'Banco antigo', 99900, { archived: true }),
  ]
  db.tables.categories = [
    { id: 'food', name: 'Alimentação', type: 'expense', color: '#ea580c', icon: 'utensils', archived: false },
    { id: 'home', name: 'Moradia', type: 'expense', color: '#0284c7', icon: 'house', archived: false },
    { id: 'salary', name: 'Salário', type: 'income', color: '#059669', icon: 'briefcase', archived: false },
  ]
  db.tables.transactions = [
    transaction('Mercado', { amount: 25000, due_date: '2026-11-05', paid_at: '2026-11-05' }),
    transaction('Aluguel', { amount: 150000, category_id: 'home', due_date: '2026-11-10' }),
    transaction('Padaria', { amount: 5000, due_date: '2026-11-20' }),
    transaction('Salário', { type: 'income', amount: 500000, category_id: 'salary', due_date: '2026-11-05', paid_at: '2026-11-05' }),
    transaction('IPTU', { amount: 80000, category_id: 'home', due_date: '2026-12-15' }),
  ]
})

afterEach(() => vi.useRealTimers())

test('é a primeira tela e mostra o saldo total e por conta, atual e previsto', async () => {
  renderAt('/')
  expect(await screen.findByRole('heading', { name: 'Início' })).toBeInTheDocument()

  // Nubank: 1.000 + 5.000 - 250 = 5.750 atual; menos 1.500, 50 e 800 pendentes = 3.400 previsto.
  // Carteira: 50. A conta arquivada fica de fora.
  const balances = (await screen.findByRole('heading', { name: 'Saldo total' })).closest('section')!
  expect(balances).toHaveTextContent(brl(580000))
  expect(balances).toHaveTextContent(`previsto ${brl(345000)}`)

  const perAccount = within(balances).getByRole('list', { name: 'Saldo por conta' })
  expect(within(perAccount).getByRole('link', { name: /Nubank/ })).toHaveTextContent(brl(575000))
  expect(within(perAccount).getByRole('link', { name: /Nubank/ })).toHaveTextContent(`previsto ${brl(340000)}`)
  expect(within(perAccount).getByRole('link', { name: /Carteira/ })).toHaveTextContent(brl(5000))
  expect(within(perAccount).queryByText('Banco antigo')).not.toBeInTheDocument()
})

test('receitas, despesas e despesas por categoria do mês batem com os lançamentos', async () => {
  renderAt('/')

  const totals = await screen.findByLabelText('Receitas e despesas do mês')
  expect(within(totals).getByText('Receitas').parentElement).toHaveTextContent(brl(500000))
  expect(within(totals).getByText('Despesas').parentElement).toHaveTextContent(brl(180000))
  expect(within(totals).getByText('Resultado').parentElement).toHaveTextContent(brl(320000))

  const rows = within(screen.getByRole('table')).getAllByRole('row')
  expect(rows.map((row) => row.textContent?.replace(/\s/g, ' '))).toEqual([
    `Moradia${brl(150000)}83%`,
    `Alimentação${brl(30000)}17%`,
  ])
})

test('trocar de mês troca os números do mês, mas não os saldos', async () => {
  const user = renderAt('/')
  await screen.findByLabelText('Receitas e despesas do mês')
  await user.click(screen.getByRole('button', { name: 'Mês seguinte' }))

  expect(await screen.findByRole('heading', { name: 'dezembro de 2026' })).toBeInTheDocument()
  const totals = await screen.findByLabelText('Receitas e despesas do mês')
  expect(within(totals).getByText('Despesas').parentElement).toHaveTextContent(brl(80000))
  expect(within(totals).getByText('Receitas').parentElement).toHaveTextContent(brl(0))
  expect(screen.getByRole('heading', { name: 'Saldo total' }).closest('section')).toHaveTextContent(brl(580000))

  await user.click(screen.getByRole('button', { name: 'Mês seguinte' }))
  expect(await screen.findByText('Nenhuma despesa neste mês.')).toBeInTheDocument()
  expect(screen.getByText('Nada pendente neste mês.')).toBeInTheDocument()
})

test('pendentes e vencidos: marcar como pago tira da lista e muda o saldo atual', async () => {
  const user = renderAt('/')
  const pending = await screen.findByRole('list', { name: 'Pendentes e vencidos' })
  expect(within(pending).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
    expect.stringContaining('Aluguel'),
    expect.stringContaining('Padaria'),
  ])
  expect(within(pending).getByRole('link', { name: /Aluguel/ })).toHaveTextContent('Vencido')
  expect(within(pending).getByRole('link', { name: /Padaria/ })).toHaveTextContent('Pendente')

  await user.click(within(pending).getByRole('button', { name: 'Marcar Aluguel como pago' }))

  await vi.waitFor(() => expect(screen.queryByRole('link', { name: /Aluguel/ })).not.toBeInTheDocument())
  expect(db.tables.transactions.find((row) => row.id === 'Aluguel')).toMatchObject({ paid_at: '2026-11-16' })
  // 5.800 - 1.500 = 4.300; o previsto não muda.
  const balances = screen.getByRole('heading', { name: 'Saldo total' }).closest('section')!
  await vi.waitFor(() => expect(balances).toHaveTextContent(brl(430000)))
  expect(balances).toHaveTextContent(`previsto ${brl(345000)}`)
})

test('sem contas, o dashboard convida a criar a primeira', async () => {
  db.reset()
  renderAt('/')
  expect(await screen.findByRole('link', { name: 'criando uma conta' })).toHaveAttribute('href', '/contas/nova')
})
