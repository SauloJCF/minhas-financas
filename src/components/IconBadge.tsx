import { cn } from 'cn'
import { FALLBACK_ICON, ICONS } from '@/lib/icons'

type Props = { color: string; icon: string; className?: string }

/** O ícone de uma conta ou categoria sobre a cor dela. */
export function IconBadge({ color, icon, className }: Props) {
  const Icon = ICONS[icon]?.Icon ?? FALLBACK_ICON
  return (
    <span
      aria-hidden
      className={cn('flex size-10 shrink-0 items-center justify-center rounded-full text-white', className)}
      style={{ backgroundColor: color }}
    >
      <Icon className="size-5" />
    </span>
  )
}
