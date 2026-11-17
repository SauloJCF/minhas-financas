import { ArrowLeft } from 'lucide-react'
import { useId, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { cn } from 'cn'
import { useAccounts, type Account } from '@/accounts/api'
import {
  cardStatementPeriod,
  openStatementMonth,
  statementTotal,
  useCardStatement,
  usePayCardStatement,
  type CardStatementPeriod,
} from '@/accounts/card-statement'
import { ErrorMessage, LoadingMessage } from '@/components/FormPage'
import { MonthNav } from '@/components/MonthNav'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { formatDate, isMonth, today } from '@/lib/dates'
import { dbErrorMessage } from '@/lib/db'
import { formatBRL } from '@/lib/money'
import { installmentLabel, useSeriesMap, type Transaction } from '@/transactions/api'
import { useOnline } from '@/lib/offline'

const shortDate = (date: string) => formatDate(date).slice(0, 5)

const fieldClass =
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30'

function StatementRow({ transaction }: { transaction: Transaction }) {
  const series = useSeriesMap().data?.get(transaction.group_id ?? '')
  const installment = installmentLabel(transaction, series)
  const refund = transaction.type === 'income'
  return (
    <li>
      <Link
        to={`/lancamentos/${transaction.id}`}
        className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">
            {transaction.description}
            {installment && ` ${installment}`}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {shortDate(transaction.due_date)}
            {!transaction.paid_at && ' · Pendente'}
          </span>
        </span>
        <span className={cn('tabular-nums', refund && 'text-primary')}>
          {refund && '-'}
          {formatBRL(transaction.amount)}
        </span>
      </Link>
    </li>
  )
}

type PayProps = {
  account: Account
  /** Contas de onde o pagamento pode sair. */
  sources: Account[]
  period: CardStatementPeriod
  total: number
}

function PayStatement({ account, sources, period, total }: PayProps) {
  const navigate = useNavigate()
  const pay = usePayCardStatement()
  const online = useOnline()
  const sourceId = useId()
  const dateId = useId()
  const [fromAccountId, setFromAccountId] = useState(sources.length === 1 ? sources[0].id : '')
  const [date, setDate] = useState(today())
  const [error, setError] = useState<string | null>(null)

  if (sources.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Para pagar a fatura por aqui, crie a conta de onde o dinheiro sai, como a conta corrente.
      </p>
    )
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!fromAccountId) return setError('Escolha a conta de onde o pagamento sai.')
    if (!date) return setError('Informe a data do pagamento.')
    setError(null)
    try {
      await pay.mutateAsync({ accountId: account.id, fromAccountId, date, period })
      // O extrato do cartão mostra a transferência que acabou de entrar.
      void navigate(`/contas/${account.id}?mes=${date.slice(0, 7)}`)
    } catch (cause) {
      setError(dbErrorMessage(cause))
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="grid gap-3 rounded-lg border p-3">
      <h2 className="font-medium">Pagar fatura</h2>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor={sourceId}>Pagar com</Label>
          <select
            id={sourceId}
            className={fieldClass}
            value={fromAccountId}
            onChange={(event) => setFromAccountId(event.target.value)}
          >
            <option value="">Escolha…</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={dateId}>Data do pagamento</Label>
          <input
            id={dateId}
            type="date"
            className={fieldClass}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Transfere {formatBRL(total)} para o cartão e marca como pagos os lançamentos pendentes desta fatura.
      </p>
      {error && <ErrorMessage>{error}</ErrorMessage>}
      <Button type="submit" disabled={pay.isPending || !online}>
        {pay.isPending ? 'Pagando…' : `Pagar ${formatBRL(total)}`}
      </Button>
    </form>
  )
}

/** A fatura de uma conta cartão: os lançamentos de um ciclo de fechamento, e o pagamento. */
export function CardStatement() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const accounts = useAccounts()
  const account = accounts.data?.find((item) => item.id === id)
  const hasCycle = account?.type === 'cartao' && account.closing_day !== null && account.due_day !== null

  // Sem mês na URL, abre a fatura que está recebendo as compras de hoje.
  const param = params.get('mes')
  const month = isMonth(param)
    ? param
    : openStatementMonth(today(), hasCycle ? account.closing_day! : 1)
  const period = hasCycle ? cardStatementPeriod(month, account.closing_day!, account.due_day!) : null
  const statement = useCardStatement(id, period)

  function setMonth(next: string) {
    const nextParams = new URLSearchParams(params)
    nextParams.set('mes', next)
    setParams(nextParams, { replace: true })
  }

  const backLink = (
    <Link
      to={account ? `/contas/${account.id}` : '/contas'}
      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft aria-hidden className="size-4" />
      {account?.name ?? 'Contas'}
    </Link>
  )

  if (!account || !period) {
    return (
      <div className="grid gap-4">
        {backLink}
        {accounts.isPending ? (
          <LoadingMessage />
        ) : (
          <ErrorMessage>
            {accounts.isError
              ? 'Não foi possível carregar a conta. Verifique sua conexão e tente de novo.'
              : !account
                ? 'Conta não encontrada.'
                : 'Esta conta não tem fatura. Informe os dias de fechamento e de vencimento na edição da conta cartão.'}
          </ErrorMessage>
        )}
      </div>
    )
  }

  const total = statementTotal(statement.data ?? [])
  const closed = today() >= period.closingDate
  const sources = (accounts.data ?? []).filter((item) => !item.archived && item.type !== 'cartao')

  return (
    <div className="grid gap-4">
      {backLink}
      <h1 className="text-xl font-semibold">Fatura</h1>

      <MonthNav month={month} onChange={setMonth} />

      <dl className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border p-3">
          <dt className="text-xs text-muted-foreground">Total da fatura</dt>
          <dd className="text-lg font-semibold tabular-nums">{formatBRL(total)}</dd>
        </div>
        <div className="rounded-xl border p-3">
          <dt className="text-xs text-muted-foreground">{closed ? 'Fechada' : 'Aberta'}</dt>
          <dd className="text-sm">
            {closed ? 'Fechou' : 'Fecha'} em {shortDate(period.closingDate)}, vence em {shortDate(period.dueDate)}
          </dd>
        </div>
      </dl>
      <p className="text-xs text-muted-foreground">
        Compras de {formatDate(period.start)} a {formatDate(period.end)}.
      </p>

      {statement.isPending && <LoadingMessage />}
      {statement.isError && (
        <ErrorMessage>Não foi possível carregar a fatura. Verifique sua conexão e tente de novo.</ErrorMessage>
      )}
      {statement.data?.length === 0 && (
        <p className="py-8 text-center text-muted-foreground">Nenhum lançamento nesta fatura.</p>
      )}
      {statement.data && statement.data.length > 0 && (
        <ul aria-label="Lançamentos da fatura">
          {statement.data.map((transaction) => (
            <StatementRow key={transaction.id} transaction={transaction} />
          ))}
        </ul>
      )}

      {statement.data && total > 0 && closed && (
        <PayStatement
          key={`${period.start}-${total}`}
          account={account}
          sources={sources}
          period={period}
          total={total}
        />
      )}
      {statement.data && total > 0 && !closed && (
        <p className="text-sm text-muted-foreground">
          Esta fatura ainda está aberta. Depois do fechamento, dá para pagá-la por aqui.
        </p>
      )}
    </div>
  )
}
