import { useNavigate, useParams } from 'react-router'
import {
  useArchiveCategory,
  useCategories,
  useDeleteCategory,
  useSaveCategory,
  type CategoryInput,
} from '@/categories/api'
import { CategoryForm } from '@/categories/CategoryForm'
import { ArchiveDeleteActions } from '@/components/ArchiveDeleteActions'
import { ErrorMessage, FormPage, LoadingMessage } from '@/components/FormPage'

const back = { to: '/categorias', label: 'Categorias' }

/** Cria uma categoria (`/categorias/nova`) ou edita a da URL (`/categorias/:id`). */
export function CategoryEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const categories = useCategories()
  const save = useSaveCategory()
  const archive = useArchiveCategory()
  const remove = useDeleteCategory()
  const backToList = () => void navigate(back.to)

  async function submit(values: CategoryInput) {
    await save.mutateAsync({ id, values })
    backToList()
  }

  if (!id) {
    return (
      <FormPage title="Nova categoria" back={back}>
        <CategoryForm onSubmit={submit} />
      </FormPage>
    )
  }

  const category = categories.data?.find((item) => item.id === id)
  if (!category) {
    return (
      <FormPage title="Editar categoria" back={back}>
        {categories.isPending ? (
          <LoadingMessage />
        ) : (
          <ErrorMessage>
            {categories.isError
              ? 'Não foi possível carregar a categoria. Verifique sua conexão e tente de novo.'
              : 'Categoria não encontrada.'}
          </ErrorMessage>
        )}
      </FormPage>
    )
  }

  return (
    <FormPage title="Editar categoria" back={back}>
      <CategoryForm key={category.id} category={category} onSubmit={submit} />
      <ArchiveDeleteActions
        name={category.name}
        archived={category.archived}
        archiveHint={
          category.archived
            ? 'Esta categoria está arquivada: não é oferecida para novos lançamentos, mas continua nos que já a usam.'
            : 'Uma categoria arquivada deixa de ser oferecida para novos lançamentos, mas continua nos que já a usam.'
        }
        inUseMessage="Esta categoria tem lançamentos e não pode ser excluída. Arquive-a."
        onArchive={(archived) => archive.mutateAsync({ id: category.id, archived })}
        onDelete={() => remove.mutateAsync(category.id)}
        onDone={backToList}
      />
    </FormPage>
  )
}
