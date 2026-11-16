import { Plus } from 'lucide-react'
import { Link } from 'react-router'
import { TRANSACTION_TYPES, useCategories, type Category } from '@/categories/api'
import { ErrorMessage, LoadingMessage } from '@/components/FormPage'
import { ListRow } from '@/components/ListRow'
import { Button } from '@/components/ui/button'

function CategoryRow({ category }: { category: Category }) {
  return (
    <ListRow
      to={`/categorias/${category.id}`}
      color={category.color}
      icon={category.icon}
      name={category.name}
      dimmed={category.archived}
    />
  )
}

export function Categories() {
  const { data: categories, isPending, isError } = useCategories()

  const active = categories?.filter((category) => !category.archived) ?? []
  const archived = categories?.filter((category) => category.archived) ?? []

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Categorias</h1>
        <Button asChild>
          <Link to="/categorias/nova">
            <Plus aria-hidden />
            Nova categoria
          </Link>
        </Button>
      </div>

      {isPending && <LoadingMessage />}
      {isError && (
        <ErrorMessage>
          Não foi possível carregar as categorias. Verifique sua conexão e tente de novo.
        </ErrorMessage>
      )}

      {categories &&
        TRANSACTION_TYPES.map((type) => {
          const ofType = active.filter((category) => category.type === type.value)
          return (
            <section key={type.value} className="grid gap-1">
              <h2 className="px-2 text-sm font-medium text-muted-foreground">{type.plural}</h2>
              {ofType.length === 0 ? (
                <p className="px-2 py-2 text-sm text-muted-foreground">
                  Nenhuma categoria de {type.label.toLowerCase()}.
                </p>
              ) : (
                <ul>
                  {ofType.map((category) => (
                    <CategoryRow key={category.id} category={category} />
                  ))}
                </ul>
              )}
            </section>
          )
        })}

      {archived.length > 0 && (
        <details>
          <summary className="cursor-pointer px-2 text-sm font-medium text-muted-foreground">
            Arquivadas ({archived.length})
          </summary>
          <ul className="mt-1">
            {archived.map((category) => (
              <CategoryRow key={category.id} category={category} />
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
