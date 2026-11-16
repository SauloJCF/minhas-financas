import { useSearchParams } from 'react-router'
import { currentMonth, isMonth } from '@/lib/dates'

/** O mês selecionado vive na URL (`?mes=2026-11`); sem ele, é o mês atual. */
export function useMonthParam(): [string, (month: string) => void] {
  const [params, setParams] = useSearchParams()
  const param = params.get('mes')
  const month = isMonth(param) ? param : currentMonth()

  function setMonth(next: string) {
    const nextParams = new URLSearchParams(params)
    nextParams.set('mes', next)
    setParams(nextParams, { replace: true })
  }
  return [month, setMonth]
}
