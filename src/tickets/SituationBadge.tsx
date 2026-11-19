import { cn } from 'cn'
import { SITUATION_LABEL, type Situation } from './api'

const COLOR: Record<Situation, string> = {
  analysis: 'bg-muted text-muted-foreground',
  waiting_you: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  approved: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
  implementing: 'bg-violet-500/15 text-violet-700 dark:text-violet-400',
  done: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  refused: 'bg-destructive/10 text-destructive',
}

/** A situação do ticket, em uma etiqueta colorida. */
export function SituationBadge({ situation }: { situation: Situation }) {
  return (
    <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', COLOR[situation])}>
      {SITUATION_LABEL[situation]}
    </span>
  )
}
