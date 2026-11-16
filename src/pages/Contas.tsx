import { ChevronRight, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { useContas, type Conta } from '@/contas/api'
import { ContaIcone } from '@/contas/ContaIcone'
import { TIPOS_CONTA } from '@/contas/options'
import { Button } from '@/components/ui/button'
import { formatBRL } from '@/lib/money'

function ContaRow({ conta }: { conta: Conta }) {
  return (
    <li>
      <Link
        to={`/contas/${conta.id}`}
        className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted"
      >
        <ContaIcone cor={conta.cor} icone={conta.icone} className={conta.arquivada ? 'opacity-50' : ''} />
        <span className="min-w-0 flex-1 truncate font-medium">{conta.nome}</span>
        <span className={conta.saldo_atual < 0 ? 'text-destructive tabular-nums' : 'tabular-nums'}>
          {formatBRL(conta.saldo_atual)}
        </span>
        <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
      </Link>
    </li>
  )
}

export function Contas() {
  const { data: contas, isPending, isError } = useContas()

  const ativas = contas?.filter((conta) => !conta.arquivada) ?? []
  const arquivadas = contas?.filter((conta) => conta.arquivada) ?? []
  const grupos = TIPOS_CONTA.map((tipo) => ({
    ...tipo,
    contas: ativas.filter((conta) => conta.tipo === tipo.value),
  })).filter((grupo) => grupo.contas.length > 0)

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Contas</h1>
        <Button asChild>
          <Link to="/contas/nova">
            <Plus aria-hidden />
            Nova conta
          </Link>
        </Button>
      </div>

      {isPending && (
        <p role="status" className="text-muted-foreground">
          Carregando…
        </p>
      )}
      {isError && (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar as contas. Verifique sua conexão e tente de novo.
        </p>
      )}

      {contas && ativas.length === 0 && (
        <p className="py-8 text-center text-muted-foreground">
          {arquivadas.length === 0
            ? 'Nenhuma conta ainda. Crie a primeira: a conta corrente, a carteira, um cartão.'
            : 'Todas as suas contas estão arquivadas.'}
        </p>
      )}

      {grupos.map((grupo) => (
        <section key={grupo.value} className="grid gap-1">
          <h2 className="px-2 text-sm font-medium text-muted-foreground">{grupo.plural}</h2>
          <ul>
            {grupo.contas.map((conta) => (
              <ContaRow key={conta.id} conta={conta} />
            ))}
          </ul>
        </section>
      ))}

      {arquivadas.length > 0 && (
        <details>
          <summary className="cursor-pointer px-2 text-sm font-medium text-muted-foreground">
            Arquivadas ({arquivadas.length})
          </summary>
          <ul className="mt-1">
            {arquivadas.map((conta) => (
              <ContaRow key={conta.id} conta={conta} />
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
