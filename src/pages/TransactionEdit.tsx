import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAccounts } from '@/accounts/api'
import { useCategories } from '@/categories/api'
import { ConfirmDeleteButton } from '@/components/ConfirmDeleteButton'
import { ErrorMessage, FormPage, LoadingMessage } from '@/components/FormPage'
import { dbErrorMessage } from '@/lib/db'
import {
  useDeleteTransaction,
  useSaveTransaction,
  useTransaction,
  type TransactionInput,
} from '@/transactions/api'
import { TransactionForm } from '@/transactions/TransactionForm'

/** Cria um lançamento (`/lancamentos/novo`) ou edita o da URL (`/lancamentos/:id`). */
export function TransactionEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const accounts = useAccounts()
  const categories = useCategories()
  const transaction = useTransaction(id)
  const save = useSaveTransaction()
  const remove = useDeleteTransaction()
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const title = id ? 'Editar lançamento' : 'Novo lançamento'
  // Volta para o mês do lançamento, que pode não ser o mês atual.
  const backTo = (dueDate?: string) => (dueDate ? `/lancamentos?mes=${dueDate.slice(0, 7)}` : '/lancamentos')
  const back = { to: backTo(transaction.data?.due_date), label: 'Lançamentos' }

  async function submit(values: TransactionInput) {
    await save.mutateAsync({ id, values })
    void navigate(backTo(values.due_date))
  }

  async function deleteTransaction() {
    setDeleteError(null)
    try {
      await remove.mutateAsync(id!)
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

  return (
    <FormPage title={title} back={back}>
      <TransactionForm
        key={id ?? 'new'}
        transaction={transaction.data ?? undefined}
        accounts={accounts.data}
        categories={categories.data}
        onSubmit={submit}
      />
      {transaction.data && (
        <section className="grid gap-3 border-t pt-6">
          <ConfirmDeleteButton
            name={transaction.data.description}
            disabled={remove.isPending}
            onConfirm={() => void deleteTransaction()}
          />
          {deleteError && <ErrorMessage>{deleteError}</ErrorMessage>}
        </section>
      )}
    </FormPage>
  )
}
