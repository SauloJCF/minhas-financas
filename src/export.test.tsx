import { screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { downloadTextFile } from '@/lib/download'
import { db } from '@/test/fake-supabase'
import { renderAt } from '@/test/render'
import type { Series, Transaction } from '@/transactions/api'
import { csvFileName, transactionsToCsv } from '@/transactions/export'

vi.mock('@/lib/supabase', () => import('@/test/fake-supabase'))
// O jsdom não baixa arquivos: o teste confere o que seria entregue.
vi.mock('@/lib/download', () => ({ downloadTextFile: vi.fn() }))

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

const lookups = {
  accountNames: new Map([['nubank', 'Nubank']]),
  categoryNames: new Map([
    ['food', 'Alimentação'],
    ['salary', 'Salário'],
  ]),
  series: new Map([['tv', { kind: 'installment', installment_count: 10 } as Series]]),
}

const csv = (items: Record<string, unknown>[]) => transactionsToCsv(items as unknown as Transaction[], lookups)
const lines = (content: string) => content.replace('\uFEFF', '').trimEnd().split('\r\n')

beforeEach(() => {
  // Só o relógio: hoje é 16/11/2026.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 16, 12))
  vi.mocked(downloadTextFile).mockClear()

  db.reset()
  db.tables.accounts = [
    { id: 'nubank', name: 'Nubank', type: 'corrente', initial_balance: 0, initial_balance_date: '2026-01-01', color: '#9333ea', icon: 'landmark', archived: false },
  ]
  db.tables.categories = [
    { id: 'food', name: 'Alimentação', type: 'expense', color: '#ea580c', icon: 'utensils', archived: false },
    { id: 'salary', name: 'Salário', type: 'income', color: '#059669', icon: 'briefcase', archived: false },
  ]
  db.tables.transactions = [
    transaction('Mercado', { amount: 25050, due_date: '2026-11-05', paid_at: '2026-11-06' }),
    transaction('Salário', { type: 'income', amount: 500000, category_id: 'salary', due_date: '2026-11-30' }),
    transaction('Outubro', { due_date: '2026-10-31' }),
    transaction('Dezembro', { due_date: '2026-12-01' }),
  ]
})

afterEach(() => vi.useRealTimers())

test('o CSV começa com BOM, usa ponto e vírgula, vírgula decimal e datas em dia/mês/ano', () => {
  const content = csv([
    transaction('Mercado', { amount: 123456, due_date: '2026-11-05', paid_at: '2026-11-06', notes: 'semana 1' }),
    transaction('Salário', { type: 'income', amount: 500000, category_id: 'salary', due_date: '2026-11-30' }),
    transaction('Bala', { amount: 5 }),
  ])
  expect(content.startsWith('\uFEFF')).toBe(true)
  expect(content.endsWith('\r\n')).toBe(true)
  expect(lines(content)).toEqual([
    'Vencimento;Pagamento;Tipo;Descrição;Categoria;Conta;Valor;Parcela;Observações',
    '05/11/2026;06/11/2026;Despesa;Mercado;Alimentação;Nubank;1234,56;;semana 1',
    '30/11/2026;;Receita;Salário;Salário;Nubank;5000,00;;',
    '10/11/2026;;Despesa;Bala;Alimentação;Nubank;0,05;;',
  ])
})

test('parcela vai como "3 de 10", para a planilha não ler como data', () => {
  const content = csv([transaction('Televisão', { group_id: 'tv', installment_number: 3 })])
  expect(lines(content)[1]).toBe('10/11/2026;;Despesa;Televisão;Alimentação;Nubank;10,00;3 de 10;')
})

test('ponto e vírgula, aspas e quebra de linha não quebram o arquivo; fórmula vira texto', () => {
  const content = csv([
    transaction('a', { description: 'Pão; leite', notes: 'disse "ok"' }),
    transaction('b', { description: 'linha 1\nlinha 2' }),
    transaction('c', { description: '=SOMA(A1:A9)', notes: '-10 de desconto' }),
  ])
  const body = content.replace('\uFEFF', '')
  expect(body).toContain('"Pão; leite";Alimentação;Nubank;10,00;;"disse ""ok"""\r\n')
  expect(body).toContain('"linha 1\nlinha 2";Alimentação')
  expect(body).toContain("'=SOMA(A1:A9);Alimentação;Nubank;10,00;;'-10 de desconto\r\n")
})

test('o nome do arquivo traz o período', () => {
  expect(csvFileName('2026-11-01', '2026-11-30')).toBe('lancamentos-2026-11-01-a-2026-11-30.csv')
})

test('exportar abre no mês atual e baixa só os lançamentos com vencimento no período', async () => {
  const user = renderAt('/lancamentos')
  await user.click(await screen.findByRole('link', { name: 'Exportar' }))

  expect(await screen.findByRole('heading', { name: 'Exportar lançamentos' })).toBeInTheDocument()
  expect(screen.getByLabelText('De')).toHaveValue('2026-11-01')
  expect(screen.getByLabelText('Até')).toHaveValue('2026-11-30')
  expect(await screen.findByText('2 lançamentos de 01/11/2026 a 30/11/2026.')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Baixar CSV' }))
  expect(downloadTextFile).toHaveBeenCalledTimes(1)
  const [fileName, content, mimeType] = vi.mocked(downloadTextFile).mock.calls[0]
  expect(fileName).toBe('lancamentos-2026-11-01-a-2026-11-30.csv')
  expect(mimeType).toBe('text/csv;charset=utf-8')
  expect(lines(content)).toEqual([
    'Vencimento;Pagamento;Tipo;Descrição;Categoria;Conta;Valor;Parcela;Observações',
    '05/11/2026;06/11/2026;Despesa;Mercado;Alimentação;Nubank;250,50;;',
    '30/11/2026;;Receita;Salário;Salário;Nubank;5000,00;;',
  ])
})

test('mudar as datas muda o que entra; período vazio ou invertido não baixa nada', async () => {
  const user = renderAt('/lancamentos/exportar')
  const first = await screen.findByLabelText('De')
  await screen.findByText(/2 lançamentos/)

  await user.clear(first)
  await user.type(first, '2026-10-31')
  expect(await screen.findByText('3 lançamentos de 31/10/2026 a 30/11/2026.')).toBeInTheDocument()

  await user.clear(first)
  await user.type(first, '2026-12-05')
  expect(await screen.findByText('Informe as duas datas, com a inicial antes da final.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Baixar CSV' })).toBeDisabled()

  await user.clear(screen.getByLabelText('Até'))
  await user.type(screen.getByLabelText('Até'), '2026-12-31')
  expect(await screen.findByText('Nenhum lançamento neste período.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Baixar CSV' })).toBeDisabled()
  expect(downloadTextFile).not.toHaveBeenCalled()
})
