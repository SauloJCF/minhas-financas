import { Download } from 'lucide-react'
import { useId, useState } from 'react'
import { useAccounts } from '@/accounts/api'
import { useCategories } from '@/categories/api'
import { ErrorMessage, FormPage, LoadingMessage } from '@/components/FormPage'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { currentMonth, formatDate, monthRange } from '@/lib/dates'
import { downloadTextFile } from '@/lib/download'
import { useSeriesMap, useTransactionsBetween } from '@/transactions/api'
import { csvFileName, transactionsToCsv } from '@/transactions/export'

const fieldClass =
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30'

const isDate = (text: string) => /^\d{4}-\d{2}-\d{2}$/.test(text)

/** Exporta os lançamentos de um período, pelo vencimento, em um CSV gerado no navegador. */
export function TransactionsExport() {
  const firstId = useId()
  const lastId = useId()
  const [first, setFirst] = useState(monthRange(currentMonth()).first)
  const [last, setLast] = useState(monthRange(currentMonth()).last)
  const valid = isDate(first) && isDate(last) && first <= last

  const transactions = useTransactionsBetween(first, last, valid)
  const accounts = useAccounts()
  const categories = useCategories()
  const series = useSeriesMap()

  const isPending = transactions.isPending || accounts.isPending || categories.isPending || series.isPending
  const isError = transactions.isError || accounts.isError || categories.isError || series.isError
  const ready = valid && !isPending && !isError
  const count = transactions.data?.length ?? 0

  function download() {
    const content = transactionsToCsv(transactions.data ?? [], {
      accountNames: new Map(accounts.data?.map((account) => [account.id, account.name])),
      categoryNames: new Map(categories.data?.map((category) => [category.id, category.name])),
      series: series.data ?? new Map(),
    })
    downloadTextFile(csvFileName(first, last), content, 'text/csv;charset=utf-8')
  }

  return (
    <FormPage title="Exportar lançamentos" back={{ to: '/lancamentos', label: 'Lançamentos' }}>
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor={firstId}>De</Label>
            <input
              id={firstId}
              type="date"
              className={fieldClass}
              value={first}
              onChange={(event) => setFirst(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={lastId}>Até</Label>
            <input
              id={lastId}
              type="date"
              className={fieldClass}
              value={last}
              onChange={(event) => setLast(event.target.value)}
            />
          </div>
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">
          Entram os lançamentos com vencimento no período, pagos e pendentes. Transferências não entram.
        </p>

        {!valid && <ErrorMessage>Informe as duas datas, com a inicial antes da final.</ErrorMessage>}
        {valid && isPending && <LoadingMessage />}
        {valid && isError && (
          <ErrorMessage>Não foi possível carregar os lançamentos. Verifique sua conexão e tente de novo.</ErrorMessage>
        )}
        {ready && (
          <p role="status" className="text-sm">
            {count === 0
              ? 'Nenhum lançamento neste período.'
              : `${count} ${count === 1 ? 'lançamento' : 'lançamentos'} de ${formatDate(first)} a ${formatDate(last)}.`}
          </p>
        )}

        <Button size="lg" disabled={!ready || count === 0} onClick={download}>
          <Download aria-hidden />
          Baixar CSV
        </Button>
        <p className="text-xs text-muted-foreground">
          O arquivo abre direto no Excel em português: colunas separadas por ponto e vírgula, valores com vírgula
          decimal e datas no formato dia/mês/ano.
        </p>
      </div>
    </FormPage>
  )
}
