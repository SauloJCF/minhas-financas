import { formatDate } from '@/lib/dates'
import { installmentLabel, type Series, type Transaction } from './api'

// CSV para abrir direto no Excel em português: ponto e vírgula entre as colunas, vírgula
// decimal, datas em dd/mm/aaaa e UTF-8 com BOM (sem ele, o Excel troca os acentos).

const SEPARATOR = ';'
const BOM = '﻿'

const HEADER = ['Vencimento', 'Pagamento', 'Tipo', 'Descrição', 'Categoria', 'Conta', 'Valor', 'Parcela', 'Observações']

/** 123456 -> "1234,56": sem "R$" nem ponto de milhar, para a planilha ler como número. */
function amountCell(centavos: number): string {
  return `${Math.floor(centavos / 100)},${String(centavos % 100).padStart(2, '0')}`
}

/**
 * Prepara um texto livre para ser uma célula. Texto que começa por =, +, - ou @ ganha um
 * apóstrofo na frente, para a planilha não o executar como fórmula. Célula com separador,
 * aspas ou quebra de linha vai entre aspas, com as aspas internas dobradas.
 */
function textCell(text: string | null): string {
  let cell = text ?? ''
  if (/^[=+\-@\t\r]/.test(cell)) cell = `'${cell}`
  return /[;"\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell
}

type Lookups = {
  accountNames: Map<string, string>
  categoryNames: Map<string, string>
  series: Map<string, Series>
}

/** O conteúdo do arquivo: uma linha de cabeçalho e uma por lançamento, na ordem recebida. */
export function transactionsToCsv(transactions: Transaction[], lookups: Lookups): string {
  const rows = transactions.map((transaction) => {
    const installment = installmentLabel(transaction, lookups.series.get(transaction.group_id ?? ''))
    return [
      formatDate(transaction.due_date),
      transaction.paid_at ? formatDate(transaction.paid_at) : '',
      transaction.type === 'income' ? 'Receita' : 'Despesa',
      textCell(transaction.description),
      textCell(lookups.categoryNames.get(transaction.category_id) ?? ''),
      textCell(lookups.accountNames.get(transaction.account_id) ?? ''),
      amountCell(transaction.amount),
      // "(3/10)" -> "3 de 10": como "3/10", a planilha leria uma data.
      installment ? installment.slice(1, -1).replace('/', ' de ') : '',
      textCell(transaction.notes),
    ].join(SEPARATOR)
  })
  return BOM + [HEADER.join(SEPARATOR), ...rows].join('\r\n') + '\r\n'
}

/** "lancamentos-2026-11-01-a-2026-11-30.csv" */
export function csvFileName(first: string, last: string): string {
  return `lancamentos-${first}-a-${last}.csv`
}
