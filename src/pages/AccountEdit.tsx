import { useNavigate, useParams } from 'react-router'
import { AccountForm } from '@/accounts/AccountForm'
import {
  useAccounts,
  useArchiveAccount,
  useDeleteAccount,
  useSaveAccount,
  type AccountInput,
} from '@/accounts/api'
import { ArchiveDeleteActions } from '@/components/ArchiveDeleteActions'
import { ErrorMessage, FormPage, LoadingMessage } from '@/components/FormPage'

const back = { to: '/contas', label: 'Contas' }

/** Cria uma conta (`/contas/nova`) ou edita a da URL (`/contas/:id`). */
export function AccountEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const accounts = useAccounts()
  const save = useSaveAccount()
  const archive = useArchiveAccount()
  const remove = useDeleteAccount()
  const backToList = () => void navigate(back.to)

  async function submit(values: AccountInput) {
    await save.mutateAsync({ id, values })
    backToList()
  }

  if (!id) {
    return (
      <FormPage title="Nova conta" back={back}>
        <AccountForm onSubmit={submit} />
      </FormPage>
    )
  }

  const account = accounts.data?.find((item) => item.id === id)
  if (!account) {
    return (
      <FormPage title="Editar conta" back={back}>
        {accounts.isPending ? (
          <LoadingMessage />
        ) : (
          <ErrorMessage>
            {accounts.isError
              ? 'Não foi possível carregar a conta. Verifique sua conexão e tente de novo.'
              : 'Conta não encontrada.'}
          </ErrorMessage>
        )}
      </FormPage>
    )
  }

  return (
    <FormPage title="Editar conta" back={back}>
      {/* key: trocar de conta recria o formulário com os valores dela. */}
      <AccountForm key={account.id} account={account} onSubmit={submit} />
      <ArchiveDeleteActions
        name={account.name}
        archived={account.archived}
        archiveHint={
          account.archived
            ? 'Esta conta está arquivada: não é oferecida para novos registros, mas o histórico continua.'
            : 'Uma conta arquivada deixa de ser oferecida para novos registros, mas o histórico continua.'
        }
        inUseMessage="Esta conta tem lançamentos ou transferências e não pode ser excluída. Arquive-a."
        onArchive={(archived) => archive.mutateAsync({ id: account.id, archived })}
        onDelete={() => remove.mutateAsync(account.id)}
        onDone={backToList}
      />
    </FormPage>
  )
}
