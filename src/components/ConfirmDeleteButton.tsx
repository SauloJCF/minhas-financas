import { useState } from 'react'
import { Button } from '@/components/ui/button'

type Props = {
  /** O nome do que será excluído, mostrado na pergunta. */
  name: string
  disabled?: boolean
  onConfirm: () => void
}

/** Botão "Excluir" que só age depois de uma confirmação na própria tela. */
export function ConfirmDeleteButton({ name, disabled, onConfirm }: Props) {
  const [confirming, setConfirming] = useState(false)

  if (!confirming) {
    return (
      <Button variant="destructive" disabled={disabled} onClick={() => setConfirming(true)}>
        Excluir
      </Button>
    )
  }
  return (
    <div className="grid gap-2 rounded-lg border border-destructive/40 p-3">
      <p className="text-sm">Excluir “{name}” de vez? Não dá para desfazer.</p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" disabled={disabled} onClick={() => setConfirming(false)}>
          Cancelar
        </Button>
        <Button variant="destructive" disabled={disabled} onClick={onConfirm}>
          Sim, excluir
        </Button>
      </div>
    </div>
  )
}
