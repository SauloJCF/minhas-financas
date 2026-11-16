import { useState } from 'react'
import { ErrorMessage } from '@/components/FormPage'
import { Button } from '@/components/ui/button'
import { dbErrorMessage } from '@/lib/db'

type Props = {
  name: string
  archived: boolean
  /** O que arquivar significa para este tipo de item. */
  archiveHint: string
  /** Mensagem para quando o banco recusa a exclusão porque o item está em uso. */
  inUseMessage: string
  onArchive: (archived: boolean) => Promise<void>
  onDelete: () => Promise<void>
  /** Chamado depois que a ação deu certo. */
  onDone: () => void
}

/** Arquivar e excluir: o que se faz com uma conta ou categoria que não se usa mais. */
export function ArchiveDeleteActions(props: Props) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(action: () => Promise<void>) {
    setError(null)
    setBusy(true)
    try {
      await action()
      props.onDone()
    } catch (caught) {
      setBusy(false)
      setConfirming(false)
      setError(dbErrorMessage(caught, props.inUseMessage))
    }
  }

  return (
    <section className="grid gap-3 border-t pt-6">
      <p className="text-sm text-muted-foreground">{props.archiveHint}</p>
      <Button variant="outline" disabled={busy} onClick={() => void run(() => props.onArchive(!props.archived))}>
        {props.archived ? 'Desarquivar' : 'Arquivar'}
      </Button>

      {confirming ? (
        <div className="grid gap-2 rounded-lg border border-destructive/40 p-3">
          <p className="text-sm">Excluir “{props.name}” de vez? Não dá para desfazer.</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={busy} onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={busy} onClick={() => void run(props.onDelete)}>
              Sim, excluir
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="destructive" disabled={busy} onClick={() => setConfirming(true)}>
          Excluir
        </Button>
      )}

      {error && <ErrorMessage>{error}</ErrorMessage>}
    </section>
  )
}
