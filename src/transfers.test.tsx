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

beforeEach(() => {
  // Só o relógio: hoje é 16/11/2026.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 16, 12))

  db.reset()
  db.tables.accounts = [account('nubank', 'Nubank', 100000), account('savings', 'Poupança', 0, { type: 'poupanca' })]
  db.tables.categories = [
    { id: 'food', name: 'Alimentação', type: 'expense', color: '#ea580c', icon: 'utensils', archived: false },
  ]
})

afterEach(() => vi.useRealTimers())

test('transferir altera o saldo das duas contas', async () => {
  const user = renderAt('/contas')
  await user.click(await screen.findByRole('link', { name: 'Transferir' }))

  await user.selectOptions(await screen.findByLabelText('Conta de origem'), 'Nubank')
  await user.selectOptions(screen.getByLabelText('Conta de destino'), 'Poupança')
  await user.type(screen.getByLabelText('Valor (R$)'), '300')
  await user.type(screen.getByLabelText('Observação (opcional)'), 'reserva')
  await user.click(screen.getByRole('button', { name: 'Transferir' }))

  const item = (await screen.findByText('reserva', { exact: false })).closest('li')!
  expect(item).toHaveTextContent('Nubank')
  expect(item).toHaveTextContent('Poupança')
  expect(item).toHaveTextContent(brl(30000))
  expect(db.tables.transfers[0]).toMatchObject({
    from_account_id: 'nubank',
    to_account_id: 'savings',
    amount: 30000,
    date: '2026-11-16',
    notes: 'reserva',
  })
  expect(db.tables.transfers[0]).not.toHaveProperty('user_id')

  await user.click(within(screen.getByRole('navigation', { name: 'Principal' })).getByRole('link', { name: 'Contas' }))
  expect(await screen.findByRole('link', { name: /Nubank/ })).toHaveTextContent(brl(70000))
  expect(screen.getByRole('link', { name: /Poupança/ })).toHaveTextContent(brl(30000))
})

test('origem e destino precisam ser contas diferentes', async () => {
  const user = renderAt('/transferencias/nova')
  await user.selectOptions(await screen.findByLabelText('Conta de origem'), 'Nubank')
  await user.selectOptions(screen.getByLabelText('Conta de destino'), 'Nubank')
  await user.type(screen.getByLabelText('Valor (R$)'), '10')
  await user.click(screen.getByRole('button', { name: 'Transferir' }))

  expect(await screen.findByText('Escolha uma conta diferente da de origem.')).toBeInTheDocument()
  expect(db.tables.transfers).toEqual([])
})

test('com uma conta só, não há para onde transferir', async () => {
  db.tables.accounts = [account('nubank', 'Nubank', 0)]
  renderAt('/transferencias/nova')
  expect(await screen.findByText(/pelo menos duas contas/)).toBeInTheDocument()

  renderAt('/contas')
  await screen.findAllByRole('link', { name: /Nubank/ })
  expect(screen.queryByRole('link', { name: 'Transferir' })).not.toBeInTheDocument()
})

test('a lista é por mês; editar e excluir uma transferência', async () => {
  db.tables.transfers = [
    { id: 't1', from_account_id: 'nubank', to_account_id: 'savings', amount: 5000, date: '2026-10-20', notes: null, created_at: '1' },
  ]
  const user = renderAt('/transferencias')
  expect(await screen.findByText('Nenhuma transferência neste mês.')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Mês anterior' }))
  await user.click(await screen.findByRole('link', { name: /Nubank/ }))

  const amount = await screen.findByLabelText('Valor (R$)')
  expect(amount).toHaveValue('50,00')
  await user.clear(amount)
  await user.type(amount, '75,50')
  await user.click(screen.getByRole('button', { name: 'Salvar' }))

  // Volta para o mês da transferência.
  expect(await screen.findByRole('heading', { name: 'outubro de 2026' })).toBeInTheDocument()
  const link = await screen.findByRole('link', { name: /Nubank/ })
  expect(link).toHaveTextContent(brl(7550))
  expect(db.tables.transfers[0]).toMatchObject({ id: 't1', amount: 7550 })

  await user.click(link)
  await user.click(await screen.findByRole('button', { name: 'Excluir' }))
  await user.click(screen.getByRole('button', { name: 'Sim, excluir' }))
  expect(await screen.findByText('Nenhuma transferência neste mês.')).toBeInTheDocument()
  expect(db.tables.transfers).toEqual([])
})

test('o extrato da conta junta lançamentos e transferências, em ordem de data', async () => {
  db.tables.transactions = [
    { id: 'tx1', type: 'expense', description: 'Mercado', amount: 25000, account_id: 'nubank', category_id: 'food', due_date: '2026-11-05', paid_at: '2026-11-06', notes: null, created_at: '1' },
    { id: 'tx2', type: 'expense', description: 'Aluguel', amount: 150000, account_id: 'nubank', category_id: 'food', due_date: '2026-11-20', paid_at: null, notes: null, created_at: '2' },
    { id: 'tx3', type: 'expense', description: 'Da poupança', amount: 100, account_id: 'savings', category_id: 'food', due_date: '2026-11-07', paid_at: '2026-11-07', notes: null, created_at: '3' },
  ]
  db.tables.transfers = [
    { id: 't1', from_account_id: 'nubank', to_account_id: 'savings', amount: 30000, date: '2026-11-10', notes: 'reserva', created_at: '4' },
  ]
  const user = renderAt('/contas')
  await user.click(await screen.findByRole('link', { name: /Nubank/ }))

  expect(await screen.findByRole('heading', { name: 'Nubank' })).toBeInTheDocument()
  // 1.000,00 - 250,00 (pago) - 300,00 (transferência); o aluguel pendente só entra no previsto.
  expect(screen.getByText('Saldo atual').parentElement).toHaveTextContent(brl(45000))
  expect(screen.getByText('Saldo previsto').parentElement).toHaveTextContent(brl(-105000))

  const entries = within(await screen.findByRole('list', { name: 'Extrato' })).getAllByRole('link')
  expect(entries.map((entry) => entry.textContent)).toEqual([
    expect.stringContaining('Aluguel'),
    expect.stringContaining('Transferência para Poupança'),
    expect.stringContaining('Mercado'),
  ])
  expect(entries[0]).toHaveTextContent('20/11 · Pendente')
  expect(entries[1]).toHaveTextContent('10/11 · reserva')
  expect(entries[1]).toHaveTextContent(brl(-30000))
  expect(entries[1]).toHaveAttribute('href', '/transferencias/t1')
  expect(entries[2]).toHaveAttribute('href', '/lancamentos/tx1')

  // Do outro lado, a mesma transferência é uma entrada.
  renderAt('/contas/savings')
  const incoming = await screen.findByRole('link', { name: /Transferência de Nubank/ })
  expect(incoming).toHaveTextContent(`+${brl(30000)}`)
})

test('transferências não aparecem na lista de lançamentos', async () => {
  db.tables.transfers = [
    { id: 't1', from_account_id: 'nubank', to_account_id: 'savings', amount: 30000, date: '2026-11-10', notes: null, created_at: '1' },
  ]
  renderAt('/lancamentos')
  expect(await screen.findByText('Nenhum lançamento neste mês.')).toBeInTheDocument()
})
