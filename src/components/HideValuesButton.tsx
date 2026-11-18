import { Eye, EyeOff } from 'lucide-react'
import { setValuesHidden, useValuesHidden } from '@/lib/hidden-values'

/** Liga e desliga os valores ocultos. Fica na moldura do app para estar sempre ao alcance. */
export function HideValuesButton() {
  const hidden = useValuesHidden()
  const Icon = hidden ? EyeOff : Eye
  return (
    <button
      type="button"
      aria-pressed={hidden}
      aria-label={hidden ? 'Mostrar valores' : 'Ocultar valores'}
      title={hidden ? 'Mostrar valores' : 'Ocultar valores'}
      onClick={() => setValuesHidden(!hidden)}
      className="-m-2 rounded-lg p-2 text-muted-foreground hover:text-foreground"
    >
      <Icon aria-hidden className="size-5" />
    </button>
  )
}
