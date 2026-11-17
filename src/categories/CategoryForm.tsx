import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { ColorField, IconField } from '@/components/ColorIconFields'
import { FormField } from '@/components/FormField'
import { ErrorMessage } from '@/components/FormPage'
import { TypeToggle } from '@/components/TypeToggle'
import { Button } from '@/components/ui/button'
import { COLORS } from '@/lib/colors'
import { dbErrorMessage } from '@/lib/db'
import { CATEGORY_ICONS } from '@/lib/icons'
import { centavosToInput, parseBRL } from '@/lib/money'
import { useOnline } from '@/lib/offline'
import { type Category, type CategoryInput } from './api'

const categorySchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome da categoria.').max(40, 'Use até 40 caracteres.'),
  type: z.enum(['expense', 'income']),
  color: z.string(),
  icon: z.string(),
  // Texto como foi digitado; vazio quer dizer sem limite.
  monthlyBudget: z
    .string()
    .refine((text) => !text.trim() || (parseBRL(text) ?? 0) > 0, 'Informe um valor maior que zero, ou deixe em branco.'),
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
  const online = useOnline()
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: category
      ? {
          name: category.name,
          type: category.type,
          color: category.color,
          icon: category.icon,
          monthlyBudget: category.monthly_budget ? centavosToInput(category.monthly_budget) : '',
        }
      : { name: '', type: 'expense', color: COLORS[0].value, icon: 'ellipsis', monthlyBudget: '' },
  })
  const isExpense = useWatch({ control, name: 'type' }) === 'expense'

  const submit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      const { monthlyBudget, ...rest } = values
      await onSubmit({
        ...rest,
        // Só categoria de despesa tem limite.
        monthly_budget: values.type === 'expense' && monthlyBudget.trim() ? parseBRL(monthlyBudget) : null,
      })
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
      {isExpense && (
        <>
          <FormField
            label="Limite mensal (R$, opcional)"
            inputMode="decimal"
            autoComplete="off"
            placeholder="Sem limite"
            error={errors.monthlyBudget?.message}
            {...register('monthlyBudget')}
          />
          <p className="-mt-2 text-xs text-muted-foreground">
            Quanto você pretende gastar por mês nesta categoria. O início mostra quanto do limite já foi usado.
          </p>
        </>
      )}
      <ColorField registration={register('color')} />
      <IconField icons={CATEGORY_ICONS} registration={register('icon')} />

      {formError && <ErrorMessage>{formError}</ErrorMessage>}
      <Button type="submit" size="lg" disabled={isSubmitting || !online}>
        {isSubmitting ? 'Salvando…' : category ? 'Salvar' : 'Criar categoria'}
      </Button>
    </form>
  )
}
