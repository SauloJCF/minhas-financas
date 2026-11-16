import { cn } from 'cn'
import { formatBRL } from '@/lib/money'

/** Um valor em reais; negativo aparece em vermelho. */
export function Money({ centavos, className }: { centavos: number; className?: string }) {
  return (
    <span className={cn('tabular-nums', centavos < 0 && 'text-destructive', className)}>
      {formatBRL(centavos)}
    </span>
  )
}
