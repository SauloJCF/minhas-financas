import { ArrowLeftRight, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { ACCOUNT_TYPES, useAccounts, type Account } from '@/accounts/api'
import { ErrorMessage, LoadingMessage } from '@/components/FormPage'
import { ListRow } from '@/components/ListRow'
import { Money } from '@/components/Money'
import { Button } from '@/components/ui/button'
import { formatBRL } from '@/lib/money'

function AccountRow({ account }: { account: Account }) {
  return (
    <ListRow
      to={`/contas/${account.id}`}
      color={account.color}
      icon={account.icon}
      name={account.name}
      dimmed={account.archived}
    >
      <span className="text-right">
        <Money centavos={account.current_balance} className="block" />
        {account.forecast_balance !== account.current_balance && (
          <span className="block text-xs text-muted-foreground">
            previsto {formatBRL(account.forecast_balance)}
          </span>
        )}
      </span>
    </ListRow>
  )
}

export function Accounts() {
  const { data: accounts, isPending, isError } = useAccounts()

  const active = accounts?.filter((account) => !account.archived) ?? []
  const archived = accounts?.filter((account) => account.archived) ?? []
  const groups = ACCOUNT_TYPES.map((type) => ({
    ...type,
    accounts: active.filter((account) => account.type === type.value),
  })).filter((group) => group.accounts.length > 0)

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Contas</h1>
        <div className="flex gap-2">
          {active.length >= 2 && (
            <Button variant="outline" asChild>
              <Link to="/transferencias/nova">
                <ArrowLeftRight aria-hidden />
                Transferir
              </Link>
            </Button>
          )}
          <Button asChild>
            <Link to="/contas/nova">
              <Plus aria-hidden />
              Nova conta
            </Link>
          </Button>
        </div>
      </div>

      {isPending && <LoadingMessage />}
      {isError && (
        <ErrorMessage>Não foi possível carregar as contas. Verifique sua conexão e tente de novo.</ErrorMessage>
      )}

      {accounts && active.length === 0 && (
        <p className="py-8 text-center text-muted-foreground">
          {archived.length === 0
            ? 'Nenhuma conta ainda. Crie a primeira: a conta corrente, a carteira, um cartão.'
            : 'Todas as suas contas estão arquivadas.'}
        </p>
      )}

      {groups.map((group) => (
        <section key={group.value} className="grid gap-1">
          <h2 className="px-2 text-sm font-medium text-muted-foreground">{group.plural}</h2>
          <ul>
            {group.accounts.map((account) => (
              <AccountRow key={account.id} account={account} />
            ))}
          </ul>
        </section>
      ))}

      {archived.length > 0 && (
        <details>
          <summary className="cursor-pointer px-2 text-sm font-medium text-muted-foreground">
            Arquivadas ({archived.length})
          </summary>
          <ul className="mt-1">
            {archived.map((account) => (
              <AccountRow key={account.id} account={account} />
            ))}
          </ul>
        </details>
      )}

      {accounts && accounts.length >= 2 && (
        <Link to="/transferencias" className="px-2 text-sm text-muted-foreground underline hover:text-foreground">
          Ver transferências entre contas
        </Link>
      )}
    </div>
  )
}
