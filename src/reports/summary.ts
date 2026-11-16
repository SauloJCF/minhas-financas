import type { Category } from '@/categories/api'
import { monthTotals } from '@/dashboard/summary'
import { addMonths } from '@/lib/dates'
import type { Transaction } from '@/transactions/api'

// Os relatórios comparam meses com a mesma regra do início: cada lançamento conta no mês do
// seu vencimento, pago ou pendente. Transferências não são lançamentos e ficam de fora.

const MONTH_NAMES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** "2026-11" -> "nov/26", para o eixo dos gráficos. */
export function shortMonth(month: string): string {
  return `${MONTH_NAMES[Number(month.slice(5)) - 1]}/${month.slice(2, 4)}`
}

/** Os `count` meses que terminam em `last`, do mais antigo para o mais recente. */
export function monthsEndingAt(last: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => addMonths(last, index - (count - 1)))
}

function groupByMonth(transactions: Transaction[]): Map<string, Transaction[]> {
  const groups = new Map<string, Transaction[]>()
  for (const transaction of transactions) {
    const month = transaction.due_date.slice(0, 7)
    groups.set(month, [...(groups.get(month) ?? []), transaction])
  }
  return groups
}

export type MonthTotals = {
  month: string
  label: string
  income: number
  expense: number
  result: number
}

/** Receitas, despesas e resultado de cada mês, em centavos. Mês sem lançamentos entra zerado. */
export function totalsByMonth(transactions: Transaction[], months: string[]): MonthTotals[] {
  const groups = groupByMonth(transactions)
  return months.map((month) => ({ month, label: shortMonth(month), ...monthTotals(groups.get(month) ?? []) }))
}

/** Id da série que junta as categorias menores. */
export const OTHER = 'other'

export type CategorySeries = { id: string; name: string }

export type CategoriesByMonth = {
  /** As categorias que viram séries, em ordem alfabética, com "Outras categorias" por último. */
  series: CategorySeries[]
  /** Uma linha por mês: o valor de cada série (pelo id) e o total de despesas. */
  rows: (Record<string, number | string> & { month: string; label: string; total: number })[]
}

/**
 * Despesas de cada mês por categoria. Só as `limit` maiores do período viram séries; o resto
 * é somado em "Outras categorias", para o gráfico não ter mais cores do que dá para distinguir.
 */
export function expensesByCategoryAndMonth(
  transactions: Transaction[],
  categories: Category[],
  months: string[],
  limit = 4,
): CategoriesByMonth {
  const expenses = transactions.filter((transaction) => transaction.type === 'expense')
  const totals = new Map<string, number>()
  for (const transaction of expenses) {
    totals.set(transaction.category_id, (totals.get(transaction.category_id) ?? 0) + transaction.amount)
  }
  const names = new Map(categories.map((category) => [category.id, category.name]))
  const ranked = [...totals.entries()]
    .map(([id, amount]) => ({ id, name: names.get(id) ?? 'Sem categoria', amount }))
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))

  // Uma categoria a mais que o limite não vale uma série "Outras" só para ela.
  const kept = ranked.length <= limit + 1 ? ranked : ranked.slice(0, limit)
  const keptIds = new Set(kept.map((item) => item.id))
  const series: CategorySeries[] = kept
    .map(({ id, name }) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name))
  if (kept.length < ranked.length) series.push({ id: OTHER, name: 'Outras categorias' })

  const groups = groupByMonth(expenses)
  const rows = months.map((month) => {
    const row: CategoriesByMonth['rows'][number] = { month, label: shortMonth(month), total: 0 }
    for (const item of series) row[item.id] = 0
    for (const transaction of groups.get(month) ?? []) {
      const key = keptIds.has(transaction.category_id) ? transaction.category_id : OTHER
      row[key] = (row[key] as number) + transaction.amount
      row.total += transaction.amount
    }
    return row
  })
  return { series, rows }
}
