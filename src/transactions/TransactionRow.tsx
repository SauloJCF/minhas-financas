import { Circle, CircleCheck, Repeat } from 'lucide-react'
import { Link } from 'react-router'
import { cn } from 'cn'
import { useCardAccountIds } from '@/accounts/api'
import { formatDate, today } from '@/lib/dates'
import { useOnline } from '@/lib/offline'
import { installmentLabel, statusOf, useSeriesMap, useSetPaid, type Transaction } from './api'
import { useFormatBRL, useValuesHidden } from '@/lib/hidden-values'

type RowProps = {
  transaction: Transaction
  accountName: string
  categoryName: string
}

export function TransactionRow({ transaction, accountName, categoryName }: RowProps) {
  const formatBRL = useFormatBRL()
  const hidden = useValuesHidden()
  const setPaid = useSetPaid()
  const online = useOnline()
  const series = useSeriesMap().data?.get(transaction.group_id ?? '')
  const installment = installmentLabel(transaction, series)
  const inCard = useCardAccountIds().has(transaction.account_id)
  const status = statusOf(transaction, today(), inCard)
  const paid = status === 'paid'
  const income = transaction.type === 'income'

  return (
    <li className="flex items-center gap-1">
      {/* Ação rápida: paga hoje, ou desfaz o pagamento. */}
      <button
        type="button"
        aria-label={paid ? `Desfazer pagamento de ${transaction.description}` : `Marcar ${transaction.description} como pago`}
        aria-pressed={paid}
        disabled={setPaid.isPending || !online}
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
          <span className="flex items-center gap-1.5 font-medium">
            <span className="truncate">
              {transaction.description}
              {installment && ` ${installment}`}
            </span>
            {series?.kind === 'recurrence' && (
              <Repeat role="img" aria-label="Recorrente" className="size-3.5 shrink-0 text-muted-foreground" />
            )}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {formatDate(transaction.due_date).slice(0, 5)} · {categoryName} · {accountName}
          </span>
        </span>
        <span className="text-right">
          <span className={cn('block tabular-nums', !hidden && income && 'text-primary')}>
            {!hidden && (income ? '+' : '-')}
            {formatBRL(transaction.amount)}
          </span>
          <span
            className={cn('block text-xs', status === 'overdue' ? 'font-medium text-destructive' : 'text-muted-foreground')}
          >
            {status === 'paid' ? 'Pago' : status === 'overdue' ? 'Vencido' : inCard ? 'Na fatura' : 'Pendente'}
          </span>
        </span>
      </Link>
    </li>
  )
}
