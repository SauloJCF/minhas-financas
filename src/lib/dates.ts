// Datas do domínio são `date` puro ("2026-11-16"), sem hora nem fuso; meses são "2026-11".

const pad = (value: number) => String(value).padStart(2, '0')

/** Hoje no fuso do aparelho. `toISOString` daria o dia em UTC, que à noite já é amanhã. */
export function today(): string {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** O mês-calendário de hoje. */
export function currentMonth(): string {
  return today().slice(0, 7)
}

export function isMonth(text: string | null): text is string {
  return text !== null && /^\d{4}-(0[1-9]|1[0-2])$/.test(text)
}

/** "2026-11", +1 -> "2026-12"; "2026-12", +1 -> "2027-01" */
export function addMonths(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number)
  const total = year * 12 + (monthNumber - 1) + delta
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`
}

/** O primeiro e o último dia do mês. */
export function monthRange(month: string): { first: string; last: string } {
  const [year, monthNumber] = month.split('-').map(Number)
  // Dia 0 do mês seguinte é o último dia deste.
  const lastDay = new Date(year, monthNumber, 0).getDate()
  return { first: `${month}-01`, last: `${month}-${pad(lastDay)}` }
}

const monthFormat = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })

/** "2026-11" -> "novembro de 2026" */
export function formatMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number)
  return monthFormat.format(new Date(Date.UTC(year, monthNumber - 1, 1)))
}

/** "2026-11-16" -> "16/11/2026" */
export function formatDate(date: string): string {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}
