import { lazy, Suspense } from 'react'
import { Link } from 'react-router'
import { useAccounts, useCardAccountIds } from '@/accounts/api'
import { useCategories } from '@/categories/api'
import { ErrorMessage, LoadingMessage } from '@/components/FormPage'
import { IconBadge } from '@/components/IconBadge'
import { Money } from '@/components/Money'
import { MonthNav } from '@/components/MonthNav'
import { expensesByCategory, monthTotals } from '@/dashboard/summary'
import { formatBRL } from '@/lib/money'
import { useMonthParam } from '@/lib/month-param'
import { useTransactions } from '@/transactions/api'
import { TransactionRow } from '@/transactions/TransactionRow'

// O Recharts é pesado: só é baixado quando há despesas para desenhar.
const ExpensesChart = lazy(() => import('@/dashboard/ExpensesChart'))

const percent = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 })

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border p-2 sm:p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      {/* Três valores lado a lado no celular: letra menor para caber R$ 99.999,99. */}
      <dd className="truncate text-sm font-semibold tabular-nums sm:text-base">{children}</dd>
    </div>
  )
}

/** A tela inicial: os saldos de agora e a visão do mês selecionado. */
export function Dashboard() {
  const [month, setMonth] = useMonthParam()
  const accounts = useAccounts()
  const categories = useCategories()
  const transactions = useTransactions(month)

  const active = accounts.data?.filter((account) => !account.archived) ?? []
  const totalCurrent = active.reduce((sum, account) => sum + account.current_balance, 0)
  const totalForecast = active.reduce((sum, account) => sum + account.forecast_balance, 0)

  const monthTransactions = transactions.data ?? []
  const totals = monthTotals(monthTransactions)
  const byCategory = expensesByCategory(monthTransactions, categories.data ?? [])
  const cardAccountIds = useCardAccountIds()
  // Vencidos também são pendentes; a lista já vem em ordem de vencimento. Pendentes de
  // cartão ficam de fora: a cobrança deles é a fatura.
  const pending = monthTransactions.filter(
    (transaction) => !transaction.paid_at && !cardAccountIds.has(transaction.account_id),
  )

  const accountNames = new Map(accounts.data?.map((account) => [account.id, account.name]))
  const categoryNames = new Map(categories.data?.map((category) => [category.id, category.name]))
  const monthPending = transactions.isPending || categories.isPending || accounts.isPending
  const monthError = transactions.isError || categories.isError

  return (
    <div className="grid gap-6">
      <h1 className="text-xl font-semibold">Início</h1>

      <section aria-labelledby="balances" className="grid gap-3 rounded-xl border p-4">
        <div>
          <h2 id="balances" className="text-sm text-muted-foreground">
            Saldo total
          </h2>
          {accounts.isPending ? (
            <LoadingMessage />
          ) : accounts.isError ? (
            <ErrorMessage>Não foi possível carregar as contas.</ErrorMessage>
          ) : (
            <>
              <p className="text-2xl font-semibold">
                <Money centavos={totalCurrent} />
              </p>
              <p className="text-sm text-muted-foreground">previsto {formatBRL(totalForecast)}</p>
            </>
          )}
        </div>

        {accounts.data && active.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Comece{' '}
            <Link to="/contas/nova" className="text-primary underline">
              criando uma conta
            </Link>
            .
          </p>
        )}
        {active.length > 0 && (
          <ul aria-label="Saldo por conta" className="grid gap-1 border-t pt-3">
            {active.map((account) => (
              <li key={account.id}>
                <Link to={`/contas/${account.id}`} className="flex items-center gap-3 rounded-lg py-1 hover:bg-muted">
                  <IconBadge color={account.color} icon={account.icon} className="size-8" />
                  <span className="min-w-0 flex-1 truncate">{account.name}</span>
                  <span className="text-right">
                    <Money centavos={account.current_balance} className="block" />
                    {account.forecast_balance !== account.current_balance && (
                      <span className="block text-xs text-muted-foreground">
                        previsto {formatBRL(account.forecast_balance)}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <MonthNav month={month} onChange={setMonth} />

      {monthPending && <LoadingMessage />}
      {monthError && (
        <ErrorMessage>Não foi possível carregar o mês. Verifique sua conexão e tente de novo.</ErrorMessage>
      )}

      {!monthPending && !monthError && (
        <>
          <dl aria-label="Receitas e despesas do mês" className="grid grid-cols-3 gap-2">
            <Tile label="Receitas">{formatBRL(totals.income)}</Tile>
            <Tile label="Despesas">{formatBRL(totals.expense)}</Tile>
            <Tile label="Resultado">
              <Money centavos={totals.result} />
            </Tile>
          </dl>

          <section aria-labelledby="by-category" className="grid gap-3">
            <h2 id="by-category" className="font-medium">
              Despesas por categoria
            </h2>
            {byCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma despesa neste mês.</p>
            ) : (
              <>
                <Suspense fallback={<div style={{ height: byCategory.length * 32 }} />}>
                  <ExpensesChart data={byCategory} />
                </Suspense>
                {/* A mesma informação do gráfico, em números. */}
                <table className="w-full text-sm">
                  <caption className="sr-only">Despesas por categoria, da maior para a menor</caption>
                  <tbody>
                    {byCategory.map((item) => (
                      <tr key={item.id} className="border-t">
                        <th scope="row" className="py-1.5 text-left font-normal">
                          {item.name}
                        </th>
                        <td className="py-1.5 text-right tabular-nums">{formatBRL(item.amount)}</td>
                        <td className="w-12 py-1.5 text-right text-muted-foreground tabular-nums">
                          {percent.format(item.share)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </section>

          <section aria-labelledby="pending" className="grid gap-1">
            <h2 id="pending" className="font-medium">
              Pendentes e vencidos
            </h2>
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nada pendente neste mês.</p>
            ) : (
              <ul aria-label="Pendentes e vencidos">
                {pending.map((transaction) => (
                  <TransactionRow
                    key={transaction.id}
                    transaction={transaction}
                    accountName={accountNames.get(transaction.account_id) ?? ''}
                    categoryName={categoryNames.get(transaction.category_id) ?? ''}
                  />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
