import { expect, test } from 'vitest'
import type { Category } from '@/categories/api'
import type { Transaction } from '@/transactions/api'
import { expensesByCategory, monthTotals } from './summary'

const transaction = (type: 'income' | 'expense', amount: number, category_id: string, paid = true) =>
  ({ type, amount, category_id, paid_at: paid ? '2026-11-10' : null }) as Transaction

const categories = ['a', 'b', 'c', 'd'].map((id) => ({ id, name: `Categoria ${id.toUpperCase()}` }) as Category)

test('monthTotals soma receitas e despesas, pagas ou pendentes', () => {
  const totals = monthTotals([
    transaction('income', 500000, 'a'),
    transaction('expense', 150000, 'b'),
    transaction('expense', 25000, 'c', false),
  ])
  expect(totals).toEqual({ income: 500000, expense: 175000, result: 325000 })
})

test('expensesByCategory ordena da maior para a menor e ignora receitas', () => {
  const totals = expensesByCategory(
    [
      transaction('expense', 1000, 'a'),
      transaction('expense', 3000, 'b'),
      transaction('expense', 2000, 'a'),
      transaction('income', 9999, 'c'),
    ],
    categories,
  )
  expect(totals).toEqual([
    { id: 'a', name: 'Categoria A', amount: 3000, share: 0.5 },
    { id: 'b', name: 'Categoria B', amount: 3000, share: 0.5 },
  ])
})

test('expensesByCategory junta as menores em "Outras categorias"', () => {
  const totals = expensesByCategory(
    [
      transaction('expense', 4000, 'a'),
      transaction('expense', 3000, 'b'),
      transaction('expense', 2000, 'c'),
      transaction('expense', 1000, 'd'),
    ],
    categories,
    1,
  )
  expect(totals.map((item) => [item.name, item.amount])).toEqual([
    ['Categoria A', 4000],
    ['Outras categorias', 6000],
  ])
  expect(totals[1].share).toBeCloseTo(0.6)
})

test('expensesByCategory sem despesas devolve lista vazia', () => {
  expect(expensesByCategory([transaction('income', 100, 'a')], categories)).toEqual([])
})
