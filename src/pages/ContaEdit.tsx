import { ArrowLeft } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import {
  contaErrorMessage,
  useArquivarConta,
  useContas,
  useExcluirConta,
  useSalvarConta,
  type Conta,
  type ContaInput,
} from '@/contas/api'
import { ContaForm } from '@/contas/ContaForm'
import { Button } from '@/components/ui/button'

function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-md gap-6">
      <div className="grid gap-2">
        <Link to="/contas" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft aria-hidden className="size-4" />
          Contas
        </Link>
        <h1 className="text-xl font-semibold">{title}</h1>
      </div>
      {children}
    </div>
  )
}

/** Arquivar e excluir: o que se faz com uma conta que não se usa mais. */
function ContaActions({ conta, onDone }: { conta: Conta; onDone: () => void }) {
  const arquivar = useArquivarConta()
  const excluir = useExcluirConta()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = arquivar.isPending || excluir.isPending

  async function run(action: () => Promise<void>) {
    setError(null)
    try {
      await action()
      onDone()
    } catch (caught) {
      setConfirming(false)
      setError(contaErrorMessage(caught))
    }
  }

  return (
    <section className="grid gap-3 border-t pt-6">
      <p className="text-sm text-muted-foreground">
        {conta.arquivada
          ? 'Esta conta está arquivada: não é oferecida para novos registros, mas o histórico continua.'
          : 'Uma conta arquivada deixa de ser oferecida para novos registros, mas o histórico continua.'}
      </p>
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => void run(() => arquivar.mutateAsync({ id: conta.id, arquivada: !conta.arquivada }))}
      >
        {conta.arquivada ? 'Desarquivar' : 'Arquivar'}
      </Button>

      {confirming ? (
        <div className="grid gap-2 rounded-lg border border-destructive/40 p-3">
          <p className="text-sm">Excluir “{conta.nome}” de vez? Não dá para desfazer.</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={busy} onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => void run(() => excluir.mutateAsync(conta.id))}
            >
              Sim, excluir
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="destructive" disabled={busy} onClick={() => setConfirming(true)}>
          Excluir
        </Button>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}

/** Cria uma conta (`/contas/nova`) ou edita a da URL (`/contas/:id`). */
export function ContaEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const contas = useContas()
  const salvar = useSalvarConta()
  const backToList = () => void navigate('/contas')

  async function save(values: ContaInput) {
    await salvar.mutateAsync({ id, values })
    backToList()
  }

  if (!id) {
    return (
      <Page title="Nova conta">
        <ContaForm onSubmit={save} />
      </Page>
    )
  }

  if (contas.isPending) {
    return (
      <Page title="Editar conta">
        <p role="status" className="text-muted-foreground">
          Carregando…
        </p>
      </Page>
    )
  }

  const conta = contas.data?.find((item) => item.id === id)
  if (!conta) {
    return (
      <Page title="Editar conta">
        <p role="alert" className="text-sm text-destructive">
          {contas.isError
            ? 'Não foi possível carregar a conta. Verifique sua conexão e tente de novo.'
            : 'Conta não encontrada.'}
        </p>
      </Page>
    )
  }

  return (
    <Page title="Editar conta">
      {/* key: trocar de conta recria o formulário com os valores dela. */}
      <ContaForm key={conta.id} conta={conta} onSubmit={save} />
      <ContaActions conta={conta} onDone={backToList} />
    </Page>
  )
}
