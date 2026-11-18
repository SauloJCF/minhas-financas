import { lazy, Suspense } from 'react'
import { useSearchParams } from 'react-router'
import { cn } from 'cn'
import { useCategories } from '@/categories/api'
import { ErrorMessage, LoadingMessage } from '@/components/FormPage'
import { currentMonth, formatMonth, monthRange } from '@/lib/dates'
import type { ChartSeries } from '@/reports/ReportChart'
import { expensesByCategoryAndMonth, monthsEndingAt, OTHER, totalsByMonth } from '@/reports/summary'
import { useTransactionsBetween } from '@/transactions/api'
import { useFormatBRL, useValuesHidden } from '@/lib/hidden-values'

// O Recharts é pesado: só é baixado quando há o que desenhar.
const ReportChart = lazy(() => import('@/reports/ReportChart'))

const PERIODS = [3, 6, 12]
const DEFAULT_PERIOD = 6

// Cores das séries, em ordem fixa (definidas em index.css, com versão para o tema escuro).
const SERIES_COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)']
const OTHER_COLOR = 'var(--series-other)'

function Legend({ series }: { series: ChartSeries[] }) {
  return (
    <ul aria-hidden className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {series.map((item) => (
        <li key={item.key} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
          {item.name}
        </li>
      ))}
    </ul>
  )
}

const cellClass = 'py-1.5 pl-3 text-right tabular-nums whitespace-nowrap'

/** Comparativos entre meses: receitas x despesas e despesas por categoria. */
export function Reports() {
  const formatBRL = useFormatBRL()
  const hidden = useValuesHidden()
  const [params, setParams] = useSearchParams()
  const requested = Number(params.get('meses'))
  const period = PERIODS.includes(requested) ? requested : DEFAULT_PERIOD

  const months = monthsEndingAt(currentMonth(), period)
  const transactions = useTransactionsBetween(monthRange(months[0]).first, monthRange(months.at(-1)!).last)
  const categories = useCategories()

  const totals = totalsByMonth(transactions.data ?? [], months)
  const byCategory = expensesByCategoryAndMonth(transactions.data ?? [], categories.data ?? [], months)

  const totalSeries: ChartSeries[] = [
    { key: 'income', name: 'Receitas', color: SERIES_COLORS[0] },
    { key: 'expense', name: 'Despesas', color: SERIES_COLORS[1] },
  ]
  // "Outras categorias" vem sempre por último, então o índice das demais é a posição na paleta.
  const categorySeries: ChartSeries[] = byCategory.series.map((item, index) => ({
    key: item.id,
    name: item.name,
    color: item.id === OTHER ? OTHER_COLOR : SERIES_COLORS[index],
  }))

  const isPending = transactions.isPending || categories.isPending
  const isError = transactions.isError || categories.isError
  const isEmpty = transactions.data?.length === 0

  return (
    <div className="grid gap-6">
      <h1 className="text-xl font-semibold">Relatórios</h1>

      <div role="group" aria-label="Período" className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
        {PERIODS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={option === period}
            onClick={() => setParams({ meses: String(option) }, { replace: true })}
            className={cn(
              'rounded-md px-2 py-1.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              option === period ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option} meses
          </button>
        ))}
      </div>
      <p className="-mt-4 text-xs text-muted-foreground">
        De {formatMonth(months[0])} a {formatMonth(months.at(-1)!)}. Cada lançamento conta no mês do vencimento,
        pago ou pendente.
      </p>

      {isPending && <LoadingMessage />}
      {isError && (
        <ErrorMessage>Não foi possível carregar os relatórios. Verifique sua conexão e tente de novo.</ErrorMessage>
      )}
      {!isPending && !isError && isEmpty && (
        <p className="py-8 text-center text-muted-foreground">Nenhum lançamento neste período.</p>
      )}

      {!isPending && !isError && !isEmpty && (
        <>
          <section aria-labelledby="income-expense" className="grid gap-3">
            <h2 id="income-expense" className="font-medium">
              Receitas e despesas
            </h2>
            <Legend series={totalSeries} />
            <Suspense fallback={<div className="h-56" />}>
              <ReportChart data={totals} series={totalSeries} />
            </Suspense>
            {/* A mesma informação do gráfico, em números. */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Receitas, despesas e resultado por mês</caption>
                <thead>
                  <tr className="text-xs text-muted-foreground">
                    <th scope="col" className="py-1.5 text-left font-normal">
                      Mês
                    </th>
                    <th scope="col" className={cn(cellClass, 'font-normal')}>
                      Receitas
                    </th>
                    <th scope="col" className={cn(cellClass, 'font-normal')}>
                      Despesas
                    </th>
                    <th scope="col" className={cn(cellClass, 'font-normal')}>
                      Resultado
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {totals.map((row) => (
                    <tr key={row.month} className="border-t">
                      <th scope="row" className="py-1.5 text-left font-normal whitespace-nowrap">
                        {row.label}
                      </th>
                      <td className={cellClass}>{formatBRL(row.income)}</td>
                      <td className={cellClass}>{formatBRL(row.expense)}</td>
                      <td className={cn(cellClass, !hidden && row.result < 0 && 'text-destructive')}>{formatBRL(row.result)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="by-category-month" className="grid gap-3">
            <h2 id="by-category-month" className="font-medium">
              Despesas por categoria
            </h2>
            {categorySeries.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma despesa neste período.</p>
            ) : (
              <>
                <Legend series={categorySeries} />
                <Suspense fallback={<div className="h-56" />}>
                  <ReportChart data={byCategory.rows} series={categorySeries} stacked />
                </Suspense>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <caption className="sr-only">Despesas por categoria em cada mês</caption>
                    <thead>
                      <tr className="text-xs text-muted-foreground">
                        <th scope="col" className="py-1.5 text-left font-normal">
                          Mês
                        </th>
                        {categorySeries.map((item) => (
                          <th key={item.key} scope="col" className={cn(cellClass, 'font-normal')}>
                            {item.name}
                          </th>
                        ))}
                        <th scope="col" className={cn(cellClass, 'font-normal')}>
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {byCategory.rows.map((row) => (
                        <tr key={row.month} className="border-t">
                          <th scope="row" className="py-1.5 text-left font-normal whitespace-nowrap">
                            {row.label}
                          </th>
                          {categorySeries.map((item) => (
                            <td key={item.key} className={cellClass}>
                              {formatBRL(Number(row[item.key]))}
                            </td>
                          ))}
                          <td className={cn(cellClass, 'font-medium')}>{formatBRL(row.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  )
}
