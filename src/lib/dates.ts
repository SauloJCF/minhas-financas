// Datas do domínio são `date` puro ("2026-11-16"), sem hora nem fuso.

/** Hoje no fuso do aparelho. `toISOString` daria o dia em UTC, que à noite já é amanhã. */
export function today(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}
