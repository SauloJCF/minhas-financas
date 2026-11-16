import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useAccounts } from '@/accounts/api'
import { ConfirmDeleteButton } from '@/components/ConfirmDeleteButton'
import { ErrorMessage, FormPage, LoadingMessage } from '@/components/FormPage'
import { formatBRL } from '@/lib/money'
import { dbErrorMessage } from '@/lib/db'
import { useDeleteTransfer, useSaveTransfer, useTransfer, type TransferInput } from '@/transfers/api'
import { TransferForm } from '@/transfers/TransferForm'

/** Cria uma transferência (`/transferencias/nova`) ou edita a da URL (`/transferencias/:id`). */
export function TransferEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const accounts = useAccounts()
  const transfer = useTransfer(id)
  const save = useSaveTransfer()
  const remove = useDeleteTransfer()
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const title = id ? 'Editar transferência' : 'Nova transferência'
  // Volta para o mês da transferência, que pode não ser o mês atual.
  const backTo = (date?: string) => (date ? `/transferencias?mes=${date.slice(0, 7)}` : '/transferencias')
  const back = { to: backTo(transfer.data?.date), label: 'Transferências' }

  async function submit(values: TransferInput) {
    await save.mutateAsync({ id, values })
    void navigate(backTo(values.date))
  }

  async function deleteTransfer() {
    setDeleteError(null)
    try {
      await remove.mutateAsync(id!)
      void navigate(back.to)
    } catch (error) {
      setDeleteError(dbErrorMessage(error))
    }
  }

  if (accounts.isPending || (id && transfer.isPending)) {
    return (
      <FormPage title={title} back={back}>
        <LoadingMessage />
      </FormPage>
    )
  }
  if (!accounts.data || (id && transfer.isError)) {
    return (
      <FormPage title={title} back={back}>
        <ErrorMessage>Não foi possível carregar. Verifique sua conexão e tente de novo.</ErrorMessage>
      </FormPage>
    )
  }
  if (id && !transfer.data) {
    return (
      <FormPage title={title} back={back}>
        <ErrorMessage>Transferência não encontrada.</ErrorMessage>
      </FormPage>
    )
  }
  if (!id && accounts.data.filter((account) => !account.archived).length < 2) {
    return (
      <FormPage title={title} back={back}>
        <p className="text-muted-foreground">
          Uma transferência leva um valor de uma conta para outra: você precisa de pelo menos duas contas.
        </p>
      </FormPage>
    )
  }

  return (
    <FormPage title={title} back={back}>
      <TransferForm
        key={id ?? 'new'}
        transfer={transfer.data ?? undefined}
        accounts={accounts.data}
        onSubmit={submit}
      />
      {transfer.data && (
        <section className="grid gap-3 border-t pt-6">
          <ConfirmDeleteButton
            name={`transferência de ${formatBRL(transfer.data.amount)}`}
            disabled={remove.isPending}
            onConfirm={() => void deleteTransfer()}
          />
          {deleteError && <ErrorMessage>{deleteError}</ErrorMessage>}
        </section>
      )}
    </FormPage>
  )
}
