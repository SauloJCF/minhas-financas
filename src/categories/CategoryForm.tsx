import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ColorField, IconField } from '@/components/ColorIconFields'
import { FormField } from '@/components/FormField'
import { ErrorMessage } from '@/components/FormPage'
import { TypeToggle } from '@/components/TypeToggle'
import { Button } from '@/components/ui/button'
import { COLORS } from '@/lib/colors'
import { dbErrorMessage } from '@/lib/db'
import { CATEGORY_ICONS } from '@/lib/icons'
import { type Category, type CategoryInput } from './api'

const categorySchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome da categoria.').max(40, 'Use até 40 caracteres.'),
  type: z.enum(['expense', 'income']),
  color: z.string(),
  icon: z.string(),
})
type CategoryFormValues = z.infer<typeof categorySchema>

type Props = {
  /** A categoria sendo editada; sem ela, o formulário cria uma nova. */
  category?: Category
  /** Grava a categoria; se lançar, o erro aparece no formulário. */
  onSubmit: (values: CategoryInput) => Promise<void>
}

export function CategoryForm({ category, onSubmit }: Props) {
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: category
      ? { name: category.name, type: category.type, color: category.color, icon: category.icon }
      : { name: '', type: 'expense', color: COLORS[0].value, icon: 'ellipsis' },
  })

  const submit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await onSubmit(values)
    } catch (error) {
      setFormError(dbErrorMessage(error))
    }
  })

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      {category ? (
        <p className="text-sm text-muted-foreground">
          Categoria de {category.type === 'income' ? 'receita' : 'despesa'}. O tipo não muda depois de criada.
        </p>
      ) : (
        <TypeToggle legend="Tipo" registration={register('type')} />
      )}

      <FormField label="Nome" autoComplete="off" error={errors.name?.message} {...register('name')} />
      <ColorField registration={register('color')} />
      <IconField icons={CATEGORY_ICONS} registration={register('icon')} />

      {formError && <ErrorMessage>{formError}</ErrorMessage>}
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? 'Salvando…' : category ? 'Salvar' : 'Criar categoria'}
      </Button>
    </form>
  )
}
