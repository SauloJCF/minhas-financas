import { Download, Plus, Sparkles } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { useAccounts, useCardAccountIds } from '@/accounts/api'
import { useCategories } from '@/categories/api'
import { ErrorMessage, LoadingMessage } from '@/components/FormPage'
import { MonthNav } from '@/components/MonthNav'
import { Button } from '@/components/ui/button'
import { today } from '@/lib/dates'
import { useMonthParam } from '@/lib/month-param'
import { statusOf, useTransactions } from '@/transactions/api'
import { TransactionRow } from '@/transactions/TransactionRow'

const STATUS_FILTERS = [
  { value: '', label: 'Todos os estados' },
  { value: 'paid', label: 'Pagos' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'overdue', label: 'Vencidos' },
]

const filterClass =
  'h-8 min-w-0 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

/** Os lançamentos de um mês, com filtros por conta, categoria e estado. O mês e os filtros vivem na URL. */
export function Transactions() {
  const [params, setParams] = useSearchParams()
  const [month] = useMonthParam()
  const accountFilter = params.get('conta') ?? ''
  const categoryFilter = params.get('categoria') ?? ''
  const statusFilter = params.get('estado') ?? ''

  const transactions = useTransactions(month)
  const accounts = useAccounts()
  const categories = useCategories()
  const cardAccountIds = useCardAccountIds()

  function setParam(name: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(name, value)
    else next.delete(name)
    setParams(next, { replace: true })
  }

  const now = today()
  const visible = (transactions.data ?? []).filter((transaction) => {
    if (accountFilter && transaction.account_id !== accountFilter) return false
    if (categoryFilter && transaction.category_id !== categoryFilter) return false
    const status = statusOf(transaction, now, cardAccountIds.has(transaction.account_id))
    // "Pendentes" inclui os vencidos, que também são pendentes.
    if (statusFilter === 'pending') return status !== 'paid'
    return !statusFilter || status === statusFilter
  })

  const accountNames = new Map(accounts.data?.map((account) => [account.id, account.name]))
  const categoryNames = new Map(categories.data?.map((category) => [category.id, category.name]))
  const isPending = transactions.isPending || accounts.isPending || categories.isPending
  const isError = transactions.isError || accounts.isError || categories.isError

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Lançamentos</h1>
        <div className="flex gap-2">
          {/* No celular os três botões não cabem com texto: os dois secundários ficam só com o ícone. */}
          <Button variant="outline" asChild>
            <Link to="/lancamentos/exportar">
              <Download aria-hidden />
              <span className="sr-only sm:not-sr-only">Exportar</span>
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/assistente">
              <Sparkles aria-hidden />
              <span className="sr-only sm:not-sr-only">Assistente</span>
            </Link>
          </Button>
          <Button asChild>
            <Link to="/lancamentos/novo">
              <Plus aria-hidden />
              Novo lançamento
            </Link>
          </Button>
        </div>
      </div>

      <MonthNav month={month} onChange={(next) => setParam('mes', next)} />

      <div className="grid grid-cols-3 gap-2">
        <select
          aria-label="Filtrar por conta"
          className={filterClass}
          value={accountFilter}
          onChange={(event) => setParam('conta', event.target.value)}
        >
          <option value="">Todas as contas</option>
          {accounts.data?.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por categoria"
          className={filterClass}
          value={categoryFilter}
          onChange={(event) => setParam('categoria', event.target.value)}
        >
          <option value="">Todas as categorias</option>
          {categories.data?.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name} ({category.type === 'income' ? 'receita' : 'despesa'})
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por estado"
          className={filterClass}
          value={statusFilter}
          onChange={(event) => setParam('estado', event.target.value)}
        >
          {STATUS_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {isPending && <LoadingMessage />}
      {isError && (
        <ErrorMessage>
          Não foi possível carregar os lançamentos. Verifique sua conexão e tente de novo.
        </ErrorMessage>
      )}

      {!isPending && !isError && visible.length === 0 && (
        <p className="py-8 text-center text-muted-foreground">
          {transactions.data?.length === 0
            ? 'Nenhum lançamento neste mês.'
            : 'Nenhum lançamento deste mês passa pelos filtros.'}
        </p>
      )}

      {!isPending && !isError && visible.length > 0 && (
        <ul>
          {visible.map((transaction) => (
            <TransactionRow
              key={transaction.id}
              transaction={transaction}
              accountName={accountNames.get(transaction.account_id) ?? ''}
              categoryName={categoryNames.get(transaction.category_id) ?? ''}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
