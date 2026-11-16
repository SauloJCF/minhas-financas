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

export type BudgetUsage = {
  /** Id da categoria. */
  id: string
  name: string
  color: string
  /** Limite mensal da categoria, em centavos. */
  limit: number
  /** Despesas da categoria no mês, pagas e pendentes. */
  spent: number
  /** Quanto falta para o limite; negativo quando estourou. */
  remaining: number
}

/**
 * O consumo do orçamento no mês: uma linha por categoria ativa com limite, da mais
 * comprometida para a menos. Pendentes contam, porque o dinheiro já está comprometido.
 */
export function budgetUsage(transactions: Transaction[], categories: Category[]): BudgetUsage[] {
  const spent = new Map<string, number>()
  for (const transaction of transactions) {
    if (transaction.type !== 'expense') continue
    spent.set(transaction.category_id, (spent.get(transaction.category_id) ?? 0) + transaction.amount)
  }
  return categories
    .filter((category) => category.monthly_budget && !category.archived)
    .map((category) => {
      const limit = category.monthly_budget!
      const used = spent.get(category.id) ?? 0
      return { id: category.id, name: category.name, color: category.color, limit, spent: used, remaining: limit - used }
    })
    .sort((a, b) => b.spent / b.limit - a.spent / a.limit || a.name.localeCompare(b.name))
}
