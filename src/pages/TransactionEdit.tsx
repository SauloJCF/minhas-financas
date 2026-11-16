import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAccounts } from '@/accounts/api'
import { useCategories } from '@/categories/api'
import { ConfirmDeleteButton } from '@/components/ConfirmDeleteButton'
import { ErrorMessage, FormPage, LoadingMessage } from '@/components/FormPage'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/dates'
import { dbErrorMessage } from '@/lib/db'
import {
  useDeleteTransaction,
  useExtendRecurrence,
  useSaveTransaction,
  useSeries,
  useTransaction,
  type Frequency,
  type SeriesScope,
  type TransactionInput,
} from '@/transactions/api'
import { TransactionForm, type SubmitOptions } from '@/transactions/TransactionForm'

const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly: 'semanal',
  monthly: 'mensal',
  yearly: 'anual',
}

/** Cria um lançamento (`/lancamentos/novo`) ou edita o da URL (`/lancamentos/:id`). */
export function TransactionEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const accounts = useAccounts()
  const categories = useCategories()
  const transaction = useTransaction(id)
  const save = useSaveTransaction()
  const remove = useDeleteTransaction()
  const series = useSeries(transaction.data?.group_id)
  const extend = useExtendRecurrence()
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [extendError, setExtendError] = useState<string | null>(null)

  const title = id ? 'Editar lançamento' : 'Novo lançamento'
  // Volta para o mês do lançamento, que pode não ser o mês atual.
  const backTo = (dueDate?: string) => (dueDate ? `/lancamentos?mes=${dueDate.slice(0, 7)}` : '/lancamentos')
  const back = { to: backTo(transaction.data?.due_date), label: 'Lançamentos' }

  async function submit(values: TransactionInput, options: SubmitOptions) {
    await save.mutateAsync({
      id,
      values,
      frequency: options.frequency,
      installments: options.installments,
      following: options.scope === 'following' ? (transaction.data ?? undefined) : undefined,
    })
    void navigate(backTo(values.due_date))
  }

  async function deleteTransaction(scope: SeriesScope) {
    setDeleteError(null)
    try {
      await remove.mutateAsync({
        id: id!,
        following: scope === 'following' ? (transaction.data ?? undefined) : undefined,
      })
      void navigate(back.to)
    } catch (error) {
      setDeleteError(dbErrorMessage(error))
    }
  }

  if (accounts.isPending || categories.isPending || (id && transaction.isPending)) {
    return (
      <FormPage title={title} back={back}>
        <LoadingMessage />
      </FormPage>
    )
  }
  if (!accounts.data || !categories.data || (id && transaction.isError)) {
    return (
      <FormPage title={title} back={back}>
        <ErrorMessage>Não foi possível carregar. Verifique sua conexão e tente de novo.</ErrorMessage>
      </FormPage>
    )
  }
  if (id && !transaction.data) {
    return (
      <FormPage title={title} back={back}>
        <ErrorMessage>Lançamento não encontrado.</ErrorMessage>
      </FormPage>
    )
  }
  if (!accounts.data.some((account) => !account.archived) && !id) {
    return (
      <FormPage title={title} back={back}>
        <p className="text-muted-foreground">
          Todo lançamento entra ou sai de uma conta.{' '}
          <Link to="/contas/nova" className="text-primary underline">
            Crie uma conta
          </Link>{' '}
          antes de lançar.
        </p>
      </FormPage>
    )
  }

  async function extendRecurrence(seriesId: string) {
    setExtendError(null)
    try {
      await extend.mutateAsync(seriesId)
    } catch (error) {
      setExtendError(dbErrorMessage(error))
    }
  }

  const inSeries = Boolean(transaction.data?.group_id)

  return (
    <FormPage title={title} back={back}>
      <TransactionForm
        key={id ?? 'new'}
        transaction={transaction.data ?? undefined}
        accounts={accounts.data}
        categories={categories.data}
        onSubmit={submit}
      />
      {series.data?.kind === 'recurrence' && (
        <section className="grid gap-3 border-t pt-6">
          <h2 className="font-medium">Recorrência {FREQUENCY_LABELS[series.data.frequency]}</h2>
          <p className="text-sm text-muted-foreground">
            Este é o lançamento {transaction.data?.installment_number} de {series.data.lastNumber}. O último vence em{' '}
            {formatDate(series.data.lastDueDate)}.
          </p>
          <Button variant="outline" disabled={extend.isPending} onClick={() => void extendRecurrence(series.data!.id)}>
            {extend.isPending ? 'Estendendo…' : 'Estender por mais 12'}
          </Button>
          {extendError && <ErrorMessage>{extendError}</ErrorMessage>}
        </section>
      )}
      {series.data?.kind === 'installment' && (
        <section className="grid gap-2 border-t pt-6">
          <h2 className="font-medium">Parcelamento</h2>
          <p className="text-sm text-muted-foreground">
            Esta é a parcela {transaction.data?.installment_number} de {series.data.installment_count}.
          </p>
        </section>
      )}
      {transaction.data && (
        <section className="grid gap-3 border-t pt-6">
          <ConfirmDeleteButton
            name={transaction.data.description}
            label={inSeries ? 'Excluir só este' : undefined}
            disabled={remove.isPending}
            onConfirm={() => void deleteTransaction('one')}
          />
          {inSeries && (
            <ConfirmDeleteButton
              name={transaction.data.description}
              label="Excluir este e os próximos"
              question={`Excluir “${transaction.data.description}” e os próximos pendentes da série? Os pagos ficam. Não dá para desfazer.`}
              disabled={remove.isPending}
              onConfirm={() => void deleteTransaction('following')}
            />
          )}
          {deleteError && <ErrorMessage>{deleteError}</ErrorMessage>}
        </section>
      )}
    </FormPage>
  )
}
