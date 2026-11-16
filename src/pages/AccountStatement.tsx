import { ArrowLeft, Pencil, ReceiptText } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { cn } from 'cn'
import { useAccounts } from '@/accounts/api'
import { useStatement, type StatementEntry } from '@/accounts/statement'
import { ErrorMessage, LoadingMessage } from '@/components/FormPage'
import { IconBadge } from '@/components/IconBadge'
import { Money } from '@/components/Money'
import { MonthNav } from '@/components/MonthNav'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/dates'
import { formatBRL } from '@/lib/money'
import { useMonthParam } from '@/lib/month-param'

function EntryRow({ entry, otherAccountName }: { entry: StatementEntry; otherAccountName?: string }) {
  const isTransfer = entry.kind === 'transfer'
  const title = isTransfer
    ? `Transferência ${entry.amount < 0 ? 'para' : 'de'} ${otherAccountName ?? 'outra conta'}`
    : entry.description

  return (
    <li>
      <Link
        to={isTransfer ? `/transferencias/${entry.id}` : `/lancamentos/${entry.id}`}
        className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{title}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {formatDate(entry.date).slice(0, 5)}
            {isTransfer && entry.description && ` · ${entry.description}`}
            {!entry.settled && ' · Pendente'}
          </span>
        </span>
        <span
          className={cn(
            'tabular-nums',
            entry.amount > 0 && 'text-primary',
            // Pendente ainda não mexeu no saldo.
            !entry.settled && 'text-muted-foreground',
          )}
        >
          {entry.amount > 0 && '+'}
          {formatBRL(entry.amount)}
        </span>
      </Link>
    </li>
  )
}

/** O extrato de uma conta: lançamentos e transferências do mês juntos, em ordem de data. */
export function AccountStatement() {
  const { id = '' } = useParams()
  const [month, setMonth] = useMonthParam()
  const accounts = useAccounts()
  const statement = useStatement(id, month)

  const backLink = (
    <Link to="/contas" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft aria-hidden className="size-4" />
      Contas
    </Link>
  )

  const account = accounts.data?.find((item) => item.id === id)
  if (!account) {
    return (
      <div className="grid gap-4">
        {backLink}
        {accounts.isPending ? (
          <LoadingMessage />
        ) : (
          <ErrorMessage>
            {accounts.isError
              ? 'Não foi possível carregar a conta. Verifique sua conexão e tente de novo.'
              : 'Conta não encontrada.'}
          </ErrorMessage>
        )}
      </div>
    )
  }

  const accountNames = new Map(accounts.data?.map((item) => [item.id, item.name]))

  return (
    <div className="grid gap-4">
      {backLink}

      <div className="flex items-center gap-3">
        <IconBadge color={account.color} icon={account.icon} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold">{account.name}</h1>
          {account.archived && <p className="text-xs text-muted-foreground">Conta arquivada</p>}
        </div>
        {account.type === 'cartao' && account.closing_day !== null && (
          <Button variant="outline" asChild>
            <Link to={`/contas/${account.id}/fatura`}>
              <ReceiptText aria-hidden />
              Fatura
            </Link>
          </Button>
        )}
        <Button variant="outline" asChild>
          <Link to={`/contas/${account.id}/editar`}>
            <Pencil aria-hidden />
            Editar
          </Link>
        </Button>
      </div>

      {account.type === 'cartao' && account.closing_day === null && (
        <p className="text-sm text-muted-foreground">
          Para ver as faturas deste cartão, informe os dias de fechamento e de vencimento na edição da conta.
        </p>
      )}

      <dl className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border p-3">
          <dt className="text-xs text-muted-foreground">Saldo atual</dt>
          <dd className="text-lg font-semibold">
            <Money centavos={account.current_balance} />
          </dd>
        </div>
        <div className="rounded-xl border p-3">
          <dt className="text-xs text-muted-foreground">Saldo previsto</dt>
          <dd className="text-lg font-semibold">
            <Money centavos={account.forecast_balance} />
          </dd>
        </div>
      </dl>

      <MonthNav month={month} onChange={setMonth} />

      {statement.isPending && <LoadingMessage />}
      {statement.isError && (
        <ErrorMessage>Não foi possível carregar o extrato. Verifique sua conexão e tente de novo.</ErrorMessage>
      )}
      {statement.data?.length === 0 && (
        <p className="py-8 text-center text-muted-foreground">Nada no extrato deste mês.</p>
      )}
      {statement.data && statement.data.length > 0 && (
        <ul aria-label="Extrato">
          {statement.data.map((entry) => (
            <EntryRow
              key={`${entry.kind}-${entry.id}`}
              entry={entry}
              otherAccountName={entry.other_account_id ? accountNames.get(entry.other_account_id) : undefined}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
