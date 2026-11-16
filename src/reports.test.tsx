import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { expensesByCategoryAndMonth, monthsEndingAt, shortMonth } from '@/reports/summary'
import { db } from '@/test/fake-supabase'
import { brl, renderAt } from '@/test/render'
import type { Transaction } from '@/transactions/api'

vi.mock('@/lib/supabase', () => import('@/test/fake-supabase'))

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
  group_id: null,
  installment_number: null,
  created_at: id,
  ...overrides,
})

const category = (id: string, name: string, type = 'expense') => ({
  id,
  name,
  type,
  color: '#059669',
  icon: 'ellipsis',
  archived: false,
  monthly_budget: null,
})

beforeEach(() => {
  // Só o relógio: hoje é 16/11/2026.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 16, 12))

  db.reset()
  db.tables.accounts = [
    { id: 'nubank', name: 'Nubank', type: 'corrente', initial_balance: 0, initial_balance_date: '2026-01-01', color: '#9333ea', icon: 'landmark', archived: false },
  ]
  db.tables.categories = [category('food', 'Alimentação'), category('home', 'Moradia'), category('salary', 'Salário', 'income')]
  db.tables.transactions = [
    transaction('Salário out', { type: 'income', amount: 500000, category_id: 'salary', due_date: '2026-10-05', paid_at: '2026-10-05' }),
    transaction('Aluguel out', { amount: 150000, category_id: 'home', due_date: '2026-10-10', paid_at: '2026-10-10' }),
    transaction('Salário nov', { type: 'income', amount: 520000, category_id: 'salary', due_date: '2026-11-05', paid_at: '2026-11-05' }),
    transaction('Aluguel nov', { amount: 150000, category_id: 'home', due_date: '2026-11-10' }),
    transaction('Mercado nov', { amount: 30000, due_date: '2026-11-12', paid_at: '2026-11-12' }),
    // Fora dos 3 meses, dentro dos 6.
    transaction('Mercado jul', { amount: 40000, due_date: '2026-07-20', paid_at: '2026-07-20' }),
    // Fora de qualquer período: o mês seguinte ao atual.
    transaction('IPTU dez', { amount: 80000, category_id: 'home', due_date: '2026-12-15' }),
  ]
})

afterEach(() => vi.useRealTimers())

const rowsOf = (table: HTMLElement) =>
  within(table)
    .getAllByRole('row')
    .map((row) => [...row.querySelectorAll('th, td')].map((cell) => cell.textContent?.replace(/\s/g, ' ')))

test('os meses do período terminam no mês atual e atravessam a virada do ano', () => {
  expect(monthsEndingAt('2027-02', 4)).toEqual(['2026-11', '2026-12', '2027-01', '2027-02'])
  expect(shortMonth('2026-11')).toBe('nov/26')
})

test('além das maiores categorias, o resto vira "Outras categorias"', () => {
  const categories = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => category(id, `Categoria ${id.toUpperCase()}`))
  const amounts = { a: 600, b: 500, c: 400, d: 300, e: 200, f: 100 }
  const transactions = Object.entries(amounts).map(([id, amount]) =>
    transaction(id, { category_id: id, amount }),
  ) as unknown as Transaction[]

  const result = expensesByCategoryAndMonth(transactions, categories as never, ['2026-11'])
  expect(result.series.map((item) => item.name)).toEqual([
    'Categoria A',
    'Categoria B',
    'Categoria C',
    'Categoria D',
    'Outras categorias',
  ])
  expect(result.rows[0]).toMatchObject({ a: 600, d: 300, other: 300, total: 2100 })
})

test('a navegação leva aos relatórios, que abrem nos últimos 6 meses', async () => {
  const user = renderAt('/')
  const nav = await screen.findByRole('navigation', { name: 'Principal' })
  await user.click(within(nav).getByRole('link', { name: 'Relatórios' }))

  expect(await screen.findByRole('heading', { name: 'Relatórios' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '6 meses' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByText(/De junho de 2026 a novembro de 2026\./)).toBeInTheDocument()

  const totals = await screen.findByRole('table', { name: 'Receitas, despesas e resultado por mês' })
  expect(rowsOf(totals)).toEqual([
    ['Mês', 'Receitas', 'Despesas', 'Resultado'],
    ['jun/26', brl(0), brl(0), brl(0)],
    ['jul/26', brl(0), brl(40000), brl(-40000)],
    ['ago/26', brl(0), brl(0), brl(0)],
    ['set/26', brl(0), brl(0), brl(0)],
    ['out/26', brl(500000), brl(150000), brl(350000)],
    // Pagos e pendentes contam, como no início.
    ['nov/26', brl(520000), brl(180000), brl(340000)],
  ])
})

test('trocar o período muda os dois comparativos', async () => {
  const user = renderAt('/relatorios')
  await screen.findByRole('table', { name: 'Receitas, despesas e resultado por mês' })
  await user.click(screen.getByRole('button', { name: '3 meses' }))

  expect(await screen.findByText(/De setembro de 2026 a novembro de 2026\./)).toBeInTheDocument()
  expect(rowsOf(screen.getByRole('table', { name: 'Receitas, despesas e resultado por mês' }))).toEqual([
    ['Mês', 'Receitas', 'Despesas', 'Resultado'],
    ['set/26', brl(0), brl(0), brl(0)],
    ['out/26', brl(500000), brl(150000), brl(350000)],
    ['nov/26', brl(520000), brl(180000), brl(340000)],
  ])
  expect(rowsOf(screen.getByRole('table', { name: 'Despesas por categoria em cada mês' }))).toEqual([
    ['Mês', 'Alimentação', 'Moradia', 'Total'],
    ['set/26', brl(0), brl(0), brl(0)],
    ['out/26', brl(0), brl(150000), brl(150000)],
    ['nov/26', brl(30000), brl(150000), brl(180000)],
  ])
})

test('o total do mês no relatório bate com o do início', async () => {
  const user = renderAt('/')
  const dashboard = await screen.findByLabelText('Receitas e despesas do mês')
  expect(within(dashboard).getByText('Despesas').parentElement).toHaveTextContent(brl(180000))
  expect(within(dashboard).getByText('Receitas').parentElement).toHaveTextContent(brl(520000))

  await user.click(within(screen.getByRole('navigation', { name: 'Principal' })).getByRole('link', { name: 'Relatórios' }))
  const totals = await screen.findByRole('table', { name: 'Receitas, despesas e resultado por mês' })
  expect(rowsOf(totals).at(-1)).toEqual(['nov/26', brl(520000), brl(180000), brl(340000)])
})

test('sem lançamentos no período, a tela avisa em vez de mostrar gráficos vazios', async () => {
  db.tables.transactions = []
  renderAt('/relatorios')
  expect(await screen.findByText('Nenhum lançamento neste período.')).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
})
