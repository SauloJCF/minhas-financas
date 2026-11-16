import type { Category } from '@/categories/api'
import type { Transaction } from '@/transactions/api'

/** Receitas e despesas de um conjunto de lançamentos, em centavos. Pendentes inclusos. */
export function monthTotals(transactions: Transaction[]) {
  let income = 0
  let expense = 0
  for (const transaction of transactions) {
    if (transaction.type === 'income') income += transaction.amount
    else expense += transaction.amount
  }
  return { income, expense, result: income - expense }
}

export type CategoryTotal = {
  /** Id da categoria, ou "other" para o agrupamento das menores. */
  id: string
  name: string
  amount: number
  /** Fração do total de despesas, de 0 a 1. */
  share: number
}

/**
 * Despesas somadas por categoria, da maior para a menor. Além das `limit` maiores, o resto
 * vira uma linha "Outras categorias", para o gráfico não ter barras demais.
 */
export function expensesByCategory(
  transactions: Transaction[],
  categories: Category[],
  limit = 7,
): CategoryTotal[] {
  const totals = new Map<string, number>()
  for (const transaction of transactions) {
    if (transaction.type !== 'expense') continue
    totals.set(transaction.category_id, (totals.get(transaction.category_id) ?? 0) + transaction.amount)
  }
  const total = [...totals.values()].reduce((sum, amount) => sum + amount, 0)
  const names = new Map(categories.map((category) => [category.id, category.name]))

  const sorted = [...totals.entries()]
    .map(([id, amount]) => ({ id, name: names.get(id) ?? 'Sem categoria', amount, share: amount / total }))
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))

  if (sorted.length <= limit + 1) return sorted
  const rest = sorted.slice(limit).reduce((sum, item) => sum + item.amount, 0)
  return [...sorted.slice(0, limit), { id: 'other', name: 'Outras categorias', amount: rest, share: rest / total }]
}
