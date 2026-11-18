import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useOnline } from '@/lib/offline'

type Props = {
  /** O nome do que será excluído, mostrado na pergunta. */
  name: string
  /** Texto do botão; o padrão é "Excluir". */
  label?: string
  /** Pergunta de confirmação; o padrão cita só o nome. */
  question?: string
  disabled?: boolean
  onConfirm: () => void
}

/** Botão "Excluir" que só age depois de uma confirmação na própria tela. */
export function ConfirmDeleteButton({ name, label = 'Excluir', question, disabled, onConfirm }: Props) {
  const [confirming, setConfirming] = useState(false)
  const online = useOnline()

  if (!confirming) {
    return (
      <Button variant="destructive" disabled={disabled || !online} onClick={() => setConfirming(true)}>
        {label}
      </Button>
    )
  }
  return (
    <div className="grid gap-2 rounded-lg border border-destructive/40 p-3">
      <p className="text-sm">{question ?? `Excluir “${name}” de vez? Não dá para desfazer.`}</p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" disabled={disabled} onClick={() => setConfirming(false)}>
          Cancelar
        </Button>
        <Button variant="destructive" disabled={disabled || !online} onClick={onConfirm}>
          Sim, excluir
        </Button>
      </div>
    </div>
  )
}
