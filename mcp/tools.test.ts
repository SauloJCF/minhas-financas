// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { checkNewTransaction, isLocalUrl, presentTransaction, summarize, toCentavos, type Transaction } from './tools.ts'

const accounts = [
  { id: 'acc-1', name: 'Nubank', type: 'corrente' as const },
  { id: 'acc-2', name: 'Cartão Inter', type: 'cartao' as const },
]
const categories = [
  { id: 'cat-1', name: 'Mercado', type: 'expense' as const },
  { id: 'cat-2', name: 'Salário', type: 'income' as const },
]
const context = { accounts, categories, today: '2026-11-16' }

const expense = {
  type: 'expense' as const,
  description: 'Mercado',
  amount: 45.9,
  account: 'acc-1',
  category: 'cat-1',
  due_date: '2026-11-15',
}

describe('toCentavos', () => {
  it('converte reais para centavos sem erro de ponto flutuante', () => {
    expect(toCentavos(45.9)).toBe(4590)
    expect(toCentavos(0.29)).toBe(29)
    expect(toCentavos('45,90')).toBe(4590)
  })

  it('recusa zero, negativo e texto que não é valor', () => {
    expect(toCentavos(0)).toBeNull()
    expect(toCentavos(-10)).toBeNull()
    expect(toCentavos('muito')).toBeNull()
  })
})

describe('checkNewTransaction', () => {
  it('monta o lançamento em centavos, pago quando o vencimento não é futuro', () => {
    expect(checkNewTransaction(expense, context)).toEqual({
      ok: true,
      values: {
        type: 'expense',
        description: 'Mercado',
        amount: 4590,
        account_id: 'acc-1',
        category_id: 'cat-1',
        due_date: '2026-11-15',
        paid_at: '2026-11-15',
        notes: null,
      },
    })
  })

  it('aceita o nome da conta e da categoria no lugar do id', () => {
    const checked = checkNewTransaction({ ...expense, account: 'nubank', category: ' Mercado ' }, context)
    expect(checked).toMatchObject({ ok: true, values: { account_id: 'acc-1', category_id: 'cat-1' } })
  })

  it('deixa pendente o que vence no futuro, a não ser que venha como pago', () => {
    const future = { ...expense, due_date: '2026-12-01' }
    expect(checkNewTransaction(future, context)).toMatchObject({ values: { paid_at: null } })
    expect(checkNewTransaction({ ...future, paid: true }, context)).toMatchObject({ values: { paid_at: '2026-12-01' } })
  })

  it('compra no cartão já nasce paga, mesmo com vencimento futuro', () => {
    const checked = checkNewTransaction({ ...expense, account: 'acc-2', due_date: '2026-12-01', paid: false }, context)
    expect(checked).toMatchObject({ values: { paid_at: '2026-12-01' } })
  })

  it('recusa valor que não é positivo', () => {
    expect(checkNewTransaction({ ...expense, amount: 0 }, context)).toMatchObject({ ok: false })
  })

  it('recusa conta que não existe', () => {
    expect(checkNewTransaction({ ...expense, account: 'Bradesco' }, context)).toMatchObject({ ok: false })
  })

  it('recusa categoria de receita em uma despesa', () => {
    const checked = checkNewTransaction({ ...expense, category: 'cat-2' }, context)
    expect(checked).toMatchObject({ ok: false, error: expect.stringContaining('despesa') })
  })
})

describe('summarize', () => {
  it('soma receitas e despesas em reais e ordena as despesas por categoria', () => {
    const all = [...categories, { id: 'cat-3', name: 'Lazer', type: 'expense' as const }]
    const summary = summarize(
      [
        { type: 'income', amount: 500000, category_id: 'cat-2' },
        { type: 'expense', amount: 4590, category_id: 'cat-1' },
        { type: 'expense', amount: 10010, category_id: 'cat-1' },
        { type: 'expense', amount: 20000, category_id: 'cat-3' },
      ],
      all,
    )
    expect(summary).toEqual({
      income: 5000,
      expense: 346,
      result: 4654,
      expenses_by_category: [
        { category: 'Lazer', amount: 200 },
        { category: 'Mercado', amount: 146 },
      ],
    })
  })

  it('devolve zeros para um mês sem lançamentos', () => {
    expect(summarize([], categories)).toEqual({ income: 0, expense: 0, result: 0, expenses_by_category: [] })
  })
})

describe('presentTransaction', () => {
  it('troca ids por nomes e centavos por reais', () => {
    const transaction = {
      id: 't-1',
      type: 'expense',
      description: 'Mercado',
      amount: 4590,
      account_id: 'acc-1',
      category_id: 'cat-1',
      due_date: '2026-11-15',
      paid_at: null,
      notes: null,
    } as Transaction
    expect(presentTransaction(transaction, { accounts, categories })).toMatchObject({
      amount: 45.9,
      account: 'Nubank',
      category: 'Mercado',
      status: 'pending',
    })
  })
})

describe('isLocalUrl', () => {
  it('só aceita endereços da própria máquina', () => {
    expect(isLocalUrl('http://127.0.0.1:54321')).toBe(true)
    expect(isLocalUrl('http://localhost:54321')).toBe(true)
    expect(isLocalUrl('https://abcdefgh.supabase.co')).toBe(false)
    expect(isLocalUrl('https://localhost.example.com')).toBe(false)
    expect(isLocalUrl('')).toBe(false)
  })
})
