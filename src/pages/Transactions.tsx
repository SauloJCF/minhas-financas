import { ChevronLeft, ChevronRight, Circle, CircleCheck, Plus } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { cn } from 'cn'
import { useAccounts } from '@/accounts/api'
import { useCategories } from '@/categories/api'
import { ErrorMessage, LoadingMessage } from '@/components/FormPage'
import { Button } from '@/components/ui/button'
import { addMonths, currentMonth, formatDate, formatMonth, isMonth, today } from '@/lib/dates'
import { formatBRL } from '@/lib/money'
import { statusOf, useSetPaid, useTransactions, type Transaction } from '@/transactions/api'

const STATUS_FILTERS = [
  { value: '', label: 'Todos os estados' },
  { value: 'paid', label: 'Pagos' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'overdue', label: 'Vencidos' },
]

const filterClass =
  'h-8 min-w-0 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

type RowProps = {
  transaction: Transaction
  accountName: string
  categoryName: string
}

function TransactionRow({ transaction, accountName, categoryName }: RowProps) {
  const setPaid = useSetPaid()
  const status = statusOf(transaction, today())
  const paid = status === 'paid'
  const income = transaction.type === 'income'

  return (
    <li className="flex items-center gap-1">
      {/* Ação rápida: paga hoje, ou desfaz o pagamento. */}
      <button
        type="button"
        aria-label={paid ? `Desfazer pagamento de ${transaction.description}` : `Marcar ${transaction.description} como pago`}
        aria-pressed={paid}
        disabled={setPaid.isPending}
        onClick={() => setPaid.mutate({ id: transaction.id, paidAt: paid ? null : today() })}
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-full outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50',
          paid ? 'text-primary' : 'text-muted-foreground',
        )}
      >
        {paid ? <CircleCheck aria-hidden className="size-6" /> : <Circle aria-hidden className="size-6" />}
      </button>

      <Link
        to={`/lancamentos/${transaction.id}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{transaction.description}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {formatDate(transaction.due_date).slice(0, 5)} · {categoryName} · {accountName}
          </span>
        </span>
        <span className="text-right">
          <span className={cn('block tabular-nums', income && 'text-primary')}>
            {income ? '+' : '-'}
            {formatBRL(transaction.amount)}
          </span>
          <span
            className={cn('block text-xs', status === 'overdue' ? 'font-medium text-destructive' : 'text-muted-foreground')}
          >
            {status === 'paid' ? 'Pago' : status === 'overdue' ? 'Vencido' : 'Pendente'}
          </span>
        </span>
      </Link>
    </li>
  )
}

/** Os lançamentos de um mês, com filtros por conta, categoria e estado. O mês e os filtros vivem na URL. */
export function Transactions() {
  const [params, setParams] = useSearchParams()
  const monthParam = params.get('mes')
  const month = isMonth(monthParam) ? monthParam : currentMonth()
  const accountFilter = params.get('conta') ?? ''
  const categoryFilter = params.get('categoria') ?? ''
  const statusFilter = params.get('estado') ?? ''

  const transactions = useTransactions(month)
  const accounts = useAccounts()
  const categories = useCategories()

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
    const status = statusOf(transaction, now)
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
        <Button asChild>
          <Link to="/lancamentos/novo">
            <Plus aria-hidden />
            Novo lançamento
          </Link>
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Mês anterior"
          onClick={() => setParam('mes', addMonths(month, -1))}
        >
          <ChevronLeft aria-hidden />
        </Button>
        <h2 className="font-medium first-letter:uppercase">{formatMonth(month)}</h2>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Mês seguinte"
          onClick={() => setParam('mes', addMonths(month, 1))}
        >
          <ChevronRight aria-hidden />
        </Button>
      </div>

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
