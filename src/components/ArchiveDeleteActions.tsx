import { useState } from 'react'
import { ConfirmDeleteButton } from '@/components/ConfirmDeleteButton'
import { ErrorMessage } from '@/components/FormPage'
import { Button } from '@/components/ui/button'
import { dbErrorMessage } from '@/lib/db'
import { useOnline } from '@/lib/offline'

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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const online = useOnline()

  async function run(action: () => Promise<void>) {
    setError(null)
    setBusy(true)
    try {
      await action()
      props.onDone()
    } catch (caught) {
      setBusy(false)
      setError(dbErrorMessage(caught, props.inUseMessage))
    }
  }

  return (
    <section className="grid gap-3 border-t pt-6">
      <p className="text-sm text-muted-foreground">{props.archiveHint}</p>
      <Button variant="outline" disabled={busy || !online} onClick={() => void run(() => props.onArchive(!props.archived))}>
        {props.archived ? 'Desarquivar' : 'Arquivar'}
      </Button>
      <ConfirmDeleteButton name={props.name} disabled={busy} onConfirm={() => void run(props.onDelete)} />
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </section>
  )
}
