// Valores são sempre inteiros em centavos; reais com vírgula só existem na tela.

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const decimal = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** 123456 -> "R$ 1.234,56" */
export function formatBRL(centavos: number): string {
  return brl.format(centavos / 100)
}

/** 123456 -> "1.234,56", para preencher um campo de valor. */
export function centavosToInput(centavos: number): string {
  return decimal.format(centavos / 100)
}

/**
 * Lê um valor digitado ("1.234,56", "-50", "R$ 10,5") e devolve centavos, ou null se não
 * for um valor. Ponto é separador de milhar; sem vírgula, "10.50" também é aceito como decimal.
 */
export function parseBRL(text: string): number | null {
  let s = text.replace(/R\$/i, '').replace(/\s/g, '').replace('−', '-')
  const negative = s.startsWith('-')
  if (negative) s = s.slice(1)

  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')

  const match = /^(\d{1,13})(?:\.(\d{1,2}))?$/.exec(s)
  if (!match) return null
  const centavos = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
  return negative && centavos !== 0 ? -centavos : centavos
}
