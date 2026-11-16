import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { addMonths, formatMonth } from '@/lib/dates'

/** "‹ Novembro de 2026 ›": navegação entre meses. O mês costuma vir de `useMonthParam`. */
export function MonthNav({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  return (
    <div className="flex items-center justify-between">
      <Button variant="ghost" size="icon" aria-label="Mês anterior" onClick={() => onChange(addMonths(month, -1))}>
        <ChevronLeft aria-hidden />
      </Button>
      <h2 className="font-medium first-letter:uppercase">{formatMonth(month)}</h2>
      <Button variant="ghost" size="icon" aria-label="Mês seguinte" onClick={() => onChange(addMonths(month, 1))}>
        <ChevronRight aria-hidden />
      </Button>
    </div>
  )
}
