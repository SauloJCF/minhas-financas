import { cn } from 'cn'
import { ICONE_RESERVA, ICONES_CONTA } from './options'

type Props = { cor: string; icone: string; className?: string }

/** O ícone da conta sobre a cor dela. */
export function ContaIcone({ cor, icone, className }: Props) {
  const Icon = ICONES_CONTA[icone]?.Icon ?? ICONE_RESERVA
  return (
    <span
      aria-hidden
      className={cn('flex size-10 shrink-0 items-center justify-center rounded-full text-white', className)}
      style={{ backgroundColor: cor }}
    >
      <Icon className="size-5" />
    </span>
  )
}
