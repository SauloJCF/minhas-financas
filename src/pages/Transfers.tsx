import { ArrowRight, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { useAccounts } from '@/accounts/api'
import { ErrorMessage, LoadingMessage } from '@/components/FormPage'
import { MonthNav } from '@/components/MonthNav'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/dates'
import { formatBRL } from '@/lib/money'
import { useMonthParam } from '@/lib/month-param'
import { useTransfers } from '@/transfers/api'

/** As transferências de um mês. */
export function Transfers() {
  const [month, setMonth] = useMonthParam()
  const transfers = useTransfers(month)
  const accounts = useAccounts()

  const accountNames = new Map(accounts.data?.map((account) => [account.id, account.name]))
  const isPending = transfers.isPending || accounts.isPending
  const isError = transfers.isError || accounts.isError

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Transferências</h1>
        <Button asChild>
          <Link to="/transferencias/nova">
            <Plus aria-hidden />
            Nova transferência
          </Link>
        </Button>
      </div>

      <MonthNav month={month} onChange={setMonth} />

      {isPending && <LoadingMessage />}
      {isError && (
        <ErrorMessage>
          Não foi possível carregar as transferências. Verifique sua conexão e tente de novo.
        </ErrorMessage>
      )}
      {transfers.data?.length === 0 && !isPending && (
        <p className="py-8 text-center text-muted-foreground">Nenhuma transferência neste mês.</p>
      )}

      {!isPending && !isError && (
        <ul>
          {transfers.data?.map((transfer) => (
            <li key={transfer.id}>
              <Link
                to={`/transferencias/${transfer.id}`}
                className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="truncate">{accountNames.get(transfer.from_account_id)}</span>
                    <ArrowRight aria-label="para" className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{accountNames.get(transfer.to_account_id)}</span>
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {formatDate(transfer.date).slice(0, 5)}
                    {transfer.notes && ` · ${transfer.notes}`}
                  </span>
                </span>
                <span className="tabular-nums">{formatBRL(transfer.amount)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
