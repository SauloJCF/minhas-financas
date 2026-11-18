import { cn } from 'cn'
import { useValuesHidden } from '@/lib/hidden-values'
import { formatBRL, HIDDEN_MONEY } from '@/lib/money'

/** Um valor em reais; negativo aparece em vermelho. Oculto, vira a máscara, sem cor. */
export function Money({ centavos, className }: { centavos: number; className?: string }) {
  const hidden = useValuesHidden()
  if (hidden) {
    return (
      <span className={cn('tabular-nums', className)}>
        <span aria-hidden>{HIDDEN_MONEY}</span>
        <span className="sr-only">valor oculto</span>
      </span>
    )
  }
  return <span className={cn('tabular-nums', centavos < 0 && 'text-destructive', className)}>{formatBRL(centavos)}</span>
}
