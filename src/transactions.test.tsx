import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { db } from '@/test/fake-supabase'
import { brl, renderAt } from '@/test/render'

vi.mock('@/lib/supabase', () => import('@/test/fake-supabase'))

function transaction(overrides: Record<string, unknown>) {
  return {
    id: 'transaction-x',
    type: 'expense',
    description: 'Lançamento',
    amount: 1000,
    account_id: 'nubank',
    category_id: 'food',
    due_date: '2026-11-10',
    paid_at: null,
    notes: null,
    created_at: '0',
    ...overrides,
  }
}

beforeEach(() => {
  // Só o relógio: hoje é 16/11/2026. Os temporizadores continuam de verdade.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 16, 12))

  db.reset()
  db.tables.accounts = [
    { id: 'nubank', name: 'Nubank', type: 'corrente', initial_balance: 100000, initial_balance_date: '2026-11-01', color: '#9333ea', icon: 'landmark', archived: false },
    { id: 'wallet', name: 'Carteira', type: 'dinheiro', initial_balance: 0, initial_balance_date: '2026-11-01', color: '#059669', icon: 'wallet', archived: false },
    { id: 'old', name: 'Banco antigo', type: 'corrente', initial_balance: 0, initial_balance_date: '2026-01-01', color: '#475569', icon: 'landmark', archived: true },
  ]
  db.tables.categories = [
    { id: 'food', name: 'Alimentação', type: 'expense', color: '#ea580c', icon: 'utensils', archived: false },
    { id: 'home', name: 'Moradia', type: 'expense', color: '#0284c7', icon: 'house', archived: false },
    { id: 'salary', name: 'Salário', type: 'income', color: '#059669', icon: 'briefcase', archived: false },
    { id: 'gone', name: 'Extinta', type: 'expense', color: '#475569', icon: 'ellipsis', archived: true },
  ]
})

afterEach(() => vi.useRealTimers())

const row = (name: RegExp) => screen.getByRole('link', { name }).closest('li')!

test('a lista mostra os lançamentos do mês com estado, e navega entre meses', async () => {
  db.tables.transactions = [
    transaction({ id: 'a', description: 'Mercado', amount: 25000, due_date: '2026-11-05', paid_at: '2026-11-05' }),
    transaction({ id: 'b', description: 'Aluguel', amount: 150000, category_id: 'home', due_date: '2026-11-10' }),
    transaction({ id: 'c', description: 'Salário', type: 'income', amount: 500000, category_id: 'salary', due_date: '2026-11-30' }),
    transaction({ id: 'd', description: 'IPTU', amount: 80000, category_id: 'home', due_date: '2026-12-15' }),
  ]
  const user = renderAt('/lancamentos')

  expect(await screen.findByRole('heading', { name: 'novembro de 2026' })).toBeInTheDocument()
  expect(await screen.findByRole('link', { name: /Mercado/ })).toHaveTextContent(`-${brl(25000)}`)
  expect(row(/Mercado/)).toHaveTextContent('Pago')
  expect(row(/Mercado/)).toHaveTextContent('05/11 · Alimentação · Nubank')
  expect(row(/Aluguel/)).toHaveTextContent('Vencido')
  expect(row(/Salário/)).toHaveTextContent(`+${brl(500000)}`)
  expect(row(/Salário/)).toHaveTextContent('Pendente')
  expect(screen.queryByText('IPTU')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Mês seguinte' }))
  expect(await screen.findByRole('heading', { name: 'dezembro de 2026' })).toBeInTheDocument()
  expect(await screen.findByRole('link', { name: /IPTU/ })).toBeInTheDocument()
  expect(screen.queryByText('Mercado')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Mês anterior' }))
  await user.click(screen.getByRole('button', { name: 'Mês anterior' }))
  expect(await screen.findByText('Nenhum lançamento neste mês.')).toBeInTheDocument()
})

test('filtros por conta, categoria e estado', async () => {
  db.tables.transactions = [
    transaction({ id: 'a', description: 'Mercado', due_date: '2026-11-05', paid_at: '2026-11-05' }),
    transaction({ id: 'b', description: 'Aluguel', category_id: 'home', due_date: '2026-11-10' }),
    transaction({ id: 'c', description: 'Padaria', account_id: 'wallet', due_date: '2026-11-20' }),
  ]
  const user = renderAt('/lancamentos')
  await screen.findByRole('link', { name: /Mercado/ })
  const shown = () => screen.getAllByRole('listitem').map((item) => within(item).getByRole('link').textContent)

  await user.selectOptions(screen.getByLabelText('Filtrar por conta'), 'Carteira')
  expect(shown()).toEqual([expect.stringContaining('Padaria')])
  await user.selectOptions(screen.getByLabelText('Filtrar por conta'), 'Todas as contas')

  await user.selectOptions(screen.getByLabelText('Filtrar por categoria'), 'Moradia (despesa)')
  expect(shown()).toEqual([expect.stringContaining('Aluguel')])
  await user.selectOptions(screen.getByLabelText('Filtrar por categoria'), 'Todas as categorias')

  await user.selectOptions(screen.getByLabelText('Filtrar por estado'), 'Pagos')
  expect(shown()).toEqual([expect.stringContaining('Mercado')])

  // Vencido também é pendente.
  await user.selectOptions(screen.getByLabelText('Filtrar por estado'), 'Pendentes')
  expect(shown()).toEqual([expect.stringContaining('Aluguel'), expect.stringContaining('Padaria')])

  await user.selectOptions(screen.getByLabelText('Filtrar por estado'), 'Vencidos')
  expect(shown()).toEqual([expect.stringContaining('Aluguel')])

  await user.selectOptions(screen.getByLabelText('Filtrar por conta'), 'Carteira')
  expect(screen.getByText('Nenhum lançamento deste mês passa pelos filtros.')).toBeInTheDocument()
})

test('marcar como pago grava o pagamento de hoje, e desfazer o apaga', async () => {
  db.tables.transactions = [transaction({ id: 'b', description: 'Aluguel', due_date: '2026-11-20' })]
  const user = renderAt('/lancamentos')

  await user.click(await screen.findByRole('button', { name: 'Marcar Aluguel como pago' }))
  expect(await screen.findByRole('button', { name: 'Desfazer pagamento de Aluguel' })).toBeInTheDocument()
  expect(row(/Aluguel/)).toHaveTextContent('Pago')
  expect(db.tables.transactions[0]).toMatchObject({ paid_at: '2026-11-16' })

  await user.click(screen.getByRole('button', { name: 'Desfazer pagamento de Aluguel' }))
  expect(await screen.findByRole('button', { name: 'Marcar Aluguel como pago' })).toBeInTheDocument()
  expect(db.tables.transactions[0]).toMatchObject({ paid_at: null })
})

test('só lançamentos pagos mudam o saldo atual; os pendentes aparecem no saldo previsto', async () => {
  db.tables.transactions = [
    transaction({ id: 'a', description: 'Mercado', amount: 25000, paid_at: '2026-11-05' }),
    transaction({ id: 'c', description: 'Salário', type: 'income', amount: 500000, category_id: 'salary', due_date: '2026-11-30' }),
  ]
  renderAt('/contas')

  const nubank = await screen.findByRole('link', { name: /Nubank/ })
  expect(nubank).toHaveTextContent(brl(75000))
  expect(nubank).toHaveTextContent(`previsto ${brl(575000)}`)
  // Sem pendentes, o previsto é igual ao atual e não é repetido.
  expect(screen.getByRole('link', { name: /Carteira/ })).not.toHaveTextContent('previsto')
})

test('criar despesa pendente: categoria do mesmo tipo, sem contas nem categorias arquivadas', async () => {
  const user = renderAt('/lancamentos')
  await user.click(await screen.findByRole('link', { name: 'Novo lançamento' }))

  const account = await screen.findByLabelText('Conta')
  const category = screen.getByLabelText('Categoria')
  const options = (select: HTMLElement) => within(select).getAllByRole('option').map((option) => option.textContent)
  expect(options(account)).toEqual(['Escolha…', 'Carteira', 'Nubank'])
  expect(options(category)).toEqual(['Escolha…', 'Alimentação', 'Moradia'])

  await user.type(screen.getByLabelText('Descrição'), 'Aluguel')
  await user.type(screen.getByLabelText('Valor (R$)'), '1.500,00')
  await user.selectOptions(account, 'Nubank')
  await user.selectOptions(category, 'Moradia')
  await user.clear(screen.getByLabelText('Vencimento'))
  await user.type(screen.getByLabelText('Vencimento'), '2026-12-10')
  await user.click(screen.getByRole('button', { name: 'Criar lançamento' }))

  // Volta para o mês do lançamento.
  expect(await screen.findByRole('heading', { name: 'dezembro de 2026' })).toBeInTheDocument()
  expect(await screen.findByRole('link', { name: /Aluguel/ })).toHaveTextContent(`-${brl(150000)}`)
  expect(db.tables.transactions[0]).toMatchObject({
    type: 'expense',
    description: 'Aluguel',
    amount: 150000,
    account_id: 'nubank',
    category_id: 'home',
    due_date: '2026-12-10',
    paid_at: null,
    notes: null,
  })
  expect(db.tables.transactions[0]).not.toHaveProperty('user_id')
})

test('criar receita paga: trocar o tipo troca as categorias e desfaz a escolha', async () => {
  const user = renderAt('/lancamentos/novo')
  const category = await screen.findByLabelText('Categoria')
  await user.selectOptions(category, 'Alimentação')

  await user.click(screen.getByRole('radio', { name: 'Receita' }))
  expect(category).toHaveValue('')
  expect(within(category).getAllByRole('option').map((option) => option.textContent)).toEqual(['Escolha…', 'Salário'])

  await user.type(screen.getByLabelText('Descrição'), 'Salário de novembro')
  await user.type(screen.getByLabelText('Valor (R$)'), '5000')
  await user.selectOptions(screen.getByLabelText('Conta'), 'Nubank')
  await user.selectOptions(category, 'Salário')
  await user.click(screen.getByRole('checkbox', { name: 'Pago' }))
  expect(screen.getByLabelText('Pagamento')).toHaveValue('2026-11-16')
  await user.type(screen.getByLabelText('Observação (opcional)'), 'com bônus')
  await user.click(screen.getByRole('button', { name: 'Criar lançamento' }))

  expect(await screen.findByRole('link', { name: /Salário de novembro/ })).toHaveTextContent(`+${brl(500000)}`)
  expect(db.tables.transactions[0]).toMatchObject({
    type: 'income',
    amount: 500000,
    category_id: 'salary',
    due_date: '2026-11-16',
    paid_at: '2026-11-16',
    notes: 'com bônus',
  })
})

test('o formulário valida antes de chamar o servidor', async () => {
  const user = renderAt('/lancamentos/novo')
  await user.type(await screen.findByLabelText('Valor (R$)'), '0')
  await user.click(screen.getByRole('button', { name: 'Criar lançamento' }))

  expect(await screen.findByText('Informe a descrição.')).toBeInTheDocument()
  expect(screen.getByText('Informe um valor maior que zero.')).toBeInTheDocument()
  expect(screen.getByText('Escolha a conta.')).toBeInTheDocument()
  expect(screen.getByText('Escolha a categoria.')).toBeInTheDocument()
  expect(db.tables.transactions).toEqual([])
})

test('sem nenhuma conta ativa, o app pede para criar uma antes de lançar', async () => {
  db.tables.accounts = []
  renderAt('/lancamentos/novo')
  expect(await screen.findByRole('link', { name: 'Crie uma conta' })).toHaveAttribute('href', '/contas/nova')
})

test('editar mantém a conta e a categoria arquivadas que o lançamento já usa', async () => {
  db.tables.transactions = [
    transaction({ id: 'a', description: 'Antigo', amount: 12345, account_id: 'old', category_id: 'gone', paid_at: '2026-11-10' }),
  ]
  const user = renderAt('/lancamentos')
  await user.click(await screen.findByRole('link', { name: /Antigo/ }))

  const description = await screen.findByLabelText('Descrição')
  expect(description).toHaveValue('Antigo')
  expect(screen.getByLabelText('Valor (R$)')).toHaveValue('123,45')
  expect(screen.getByLabelText('Conta')).toHaveDisplayValue('Banco antigo')
  expect(screen.getByLabelText('Categoria')).toHaveDisplayValue('Extinta')
  expect(screen.getByRole('checkbox', { name: 'Pago' })).toBeChecked()

  await user.clear(description)
  await user.type(description, 'Corrigido')
  await user.click(screen.getByRole('checkbox', { name: 'Pago' }))
  await user.click(screen.getByRole('button', { name: 'Salvar' }))

  expect(await screen.findByRole('link', { name: /Corrigido/ })).toBeInTheDocument()
  expect(db.tables.transactions[0]).toMatchObject({
    id: 'a',
    description: 'Corrigido',
    account_id: 'old',
    category_id: 'gone',
    paid_at: null,
  })
})

test('excluir apaga o lançamento de verdade, depois de confirmar', async () => {
  db.tables.transactions = [transaction({ id: 'a', description: 'Engano' })]
  const user = renderAt('/lancamentos/a')
  await user.click(await screen.findByRole('button', { name: 'Excluir' }))
  expect(db.tables.transactions).toHaveLength(1)

  await user.click(screen.getByRole('button', { name: 'Sim, excluir' }))
  expect(await screen.findByText('Nenhum lançamento neste mês.')).toBeInTheDocument()
  expect(db.tables.transactions).toEqual([])
})

test('lançamento que não existe (ou é de outro usuário) aparece como não encontrado', async () => {
  renderAt('/lancamentos/nao-existe')
  expect(await screen.findByRole('alert')).toHaveTextContent('Lançamento não encontrado.')
})
