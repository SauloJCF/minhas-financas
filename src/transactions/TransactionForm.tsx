import { zodResolver } from '@hookform/resolvers/zod'
import { useId, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import type { Account } from '@/accounts/api'
import type { Category } from '@/categories/api'
import { FormField } from '@/components/FormField'
import { ErrorMessage } from '@/components/FormPage'
import { SelectField } from '@/components/SelectField'
import { TypeToggle } from '@/components/TypeToggle'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { today } from '@/lib/dates'
import { dbErrorMessage } from '@/lib/db'
import { centavosToInput, formatBRL, parseBRL } from '@/lib/money'
import { splitInstallments, type Frequency, type SeriesScope, type Transaction, type TransactionInput } from './api'

const isDate = (text: string) => z.iso.date().safeParse(text).success

/** O número de parcelas digitado, se for um inteiro de 2 a 48. */
function parseInstallments(text: string): number | null {
  if (!/^\d{1,2}$/.test(text.trim())) return null
  const count = Number(text)
  return count >= 2 && count <= 48 ? count : null
}

/** O que o formulário guarda: tudo como foi digitado. */
const transactionSchema = z
  .object({
    type: z.enum(['expense', 'income']),
    description: z.string().trim().min(1, 'Informe a descrição.').max(100, 'Use até 100 caracteres.'),
    amount: z.string().refine((text) => (parseBRL(text) ?? 0) > 0, 'Informe um valor maior que zero.'),
    accountId: z.string().min(1, 'Escolha a conta.'),
    categoryId: z.string().min(1, 'Escolha a categoria.'),
    dueDate: z.string().refine(isDate, 'Informe o vencimento.'),
    paid: z.boolean(),
    paidAt: z.string(),
    notes: z.string().trim().max(500, 'Use até 500 caracteres.'),
    repeat: z.enum(['none', 'installment', 'recurrence']),
    installments: z.string(),
    frequency: z.enum(['weekly', 'monthly', 'yearly']),
    scope: z.enum(['one', 'following']),
  })
  .refine((values) => !values.paid || isDate(values.paidAt), {
    path: ['paidAt'],
    message: 'Informe a data do pagamento.',
  })
  .refine((values) => values.repeat !== 'installment' || parseInstallments(values.installments) !== null, {
    path: ['installments'],
    message: 'Informe de 2 a 48 parcelas.',
  })
  .refine(
    (values) =>
      values.repeat !== 'installment' ||
      (parseBRL(values.amount) ?? 0) >= (parseInstallments(values.installments) ?? 0),
    { path: ['amount'], message: 'O total precisa dar pelo menos um centavo por parcela.' },
  )
type TransactionFormValues = z.infer<typeof transactionSchema>

type Props = {
  /** O lançamento sendo editado; sem ele, o formulário cria um novo. */
  transaction?: Transaction
  /** Todas as contas e categorias do usuário; as arquivadas só aparecem se já estiverem em uso aqui. */
  accounts: Account[]
  categories: Category[]
  /** Grava o lançamento; se lançar, o erro aparece no formulário. */
  onSubmit: (values: TransactionInput, options: SubmitOptions) => Promise<void>
}

export type SubmitOptions = {
  /** Ao criar: a frequência da recorrência, ou `null` se o lançamento não se repete. */
  frequency: Frequency | null
  /** Ao criar: o número de parcelas, ou `null` se o lançamento não é parcelado. O valor é o total. */
  installments: number | null
  /** Ao editar um lançamento de série: até onde a alteração vai. */
  scope: SeriesScope
}

const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensal' },
  { value: 'yearly', label: 'Anual' },
]

export function TransactionForm({ transaction, accounts, categories, onSubmit }: Props) {
  const [formError, setFormError] = useState<string | null>(null)
  const notesId = useId()

  // Arquivadas não são oferecidas, mas a que o lançamento já usa continua na lista.
  const offeredAccounts = accounts.filter((account) => !account.archived || account.id === transaction?.account_id)
  const isCard = (accountId: string) => accounts.some((account) => account.id === accountId && account.type === 'cartao')
  const defaultAccountId = offeredAccounts.length === 1 ? offeredAccounts[0].id : ''
  const offeredCategories = categories.filter(
    (category) => !category.archived || category.id === transaction?.category_id,
  )

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    control,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: transaction
      ? {
          type: transaction.type,
          description: transaction.description,
          amount: centavosToInput(transaction.amount),
          accountId: transaction.account_id,
          categoryId: transaction.category_id,
          dueDate: transaction.due_date,
          paid: transaction.paid_at !== null,
          paidAt: transaction.paid_at ?? today(),
          notes: transaction.notes ?? '',
          repeat: 'none',
          installments: '2',
          frequency: 'monthly',
          scope: 'one',
        }
      : {
          type: 'expense',
          description: '',
          amount: '',
          // Com uma conta só, não há o que escolher.
          accountId: defaultAccountId,
          categoryId: '',
          dueDate: today(),
          // Compra no cartão já nasce paga: entra na dívida do cartão na data da compra.
          paid: isCard(defaultAccountId),
          paidAt: today(),
          notes: '',
          repeat: 'none',
          installments: '2',
          frequency: 'monthly',
          scope: 'one',
        },
  })

  const type = useWatch({ control, name: 'type' })
  const paid = useWatch({ control, name: 'paid' })
  const inCard = isCard(useWatch({ control, name: 'accountId' }))
  const repeat = useWatch({ control, name: 'repeat' })
  const amountText = useWatch({ control, name: 'amount' })
  const installmentsText = useWatch({ control, name: 'installments' })
  const installments = repeat === 'installment' && !transaction ? parseInstallments(installmentsText) : null
  const total = parseBRL(amountText) ?? 0
  const split = installments && total >= installments ? splitInstallments(total, installments) : null
  const inSeries = Boolean(transaction?.group_id)

  const submit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      const options: SubmitOptions = {
        frequency: !transaction && values.repeat === 'recurrence' ? values.frequency : null,
        installments: !transaction && values.repeat === 'installment' ? parseInstallments(values.installments) : null,
        scope: inSeries ? values.scope : 'one',
      }
      const input: TransactionInput = {
        type: values.type,
        description: values.description,
        // O schema já garantiu que o texto é um valor positivo.
        amount: parseBRL(values.amount) ?? 0,
        account_id: values.accountId,
        category_id: values.categoryId,
        due_date: values.dueDate,
        paid_at: values.paid ? values.paidAt : null,
        notes: values.notes || null,
      }
      await onSubmit(input, options)
    } catch (error) {
      setFormError(dbErrorMessage(error))
    }
  })

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <TypeToggle
        legend="Tipo"
        registration={register('type', {
          // A categoria é sempre do mesmo tipo do lançamento: trocar o tipo desfaz a escolha.
          onChange: () => setValue('categoryId', ''),
        })}
      />

      <FormField
        label="Descrição"
        autoComplete="off"
        error={errors.description?.message}
        {...register('description')}
      />

      <div className="grid grid-cols-2 gap-4">
        <FormField
          label={repeat === 'installment' && !transaction ? 'Valor total (R$)' : 'Valor (R$)'}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0,00"
          error={errors.amount?.message}
          {...register('amount')}
        />
        <FormField
          label="Vencimento"
          type="date"
          error={errors.dueDate?.message}
          {...register('dueDate', {
            // Em compra nova no cartão, o pagamento acompanha a data da compra.
            onChange: (event) => {
              if (!transaction && isCard(getValues('accountId'))) setValue('paidAt', event.target.value)
            },
          })}
        />
      </div>

      <SelectField
        label="Conta"
        error={errors.accountId?.message}
        {...register('accountId', {
          onChange: (event) => {
            if (transaction || !isCard(event.target.value)) return
            setValue('paid', true)
            setValue('paidAt', getValues('dueDate'))
          },
        })}
      >
        <option value="">Escolha…</option>
        {offeredAccounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name}
          </option>
        ))}
      </SelectField>

      <SelectField label="Categoria" error={errors.categoryId?.message} {...register('categoryId')}>
        <option value="">Escolha…</option>
        {offeredCategories
          .filter((category) => category.type === type)
          .map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
      </SelectField>

      {inCard && !transaction && (
        <p className="-mt-2 text-xs text-muted-foreground">
          Compra no cartão: o vencimento é a data da compra, e ela já entra como paga na dívida do cartão.
        </p>
      )}

      <div className="grid gap-3 rounded-lg border p-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" className="size-4 accent-primary" {...register('paid')} />
          Pago
        </label>
        {paid ? (
          <FormField label="Pagamento" type="date" error={errors.paidAt?.message} {...register('paidAt')} />
        ) : (
          <p className="text-xs text-muted-foreground">
            Pendente: só entra no saldo atual da conta depois de pago.
          </p>
        )}
      </div>

      {!transaction && (
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Repetir" {...register('repeat')}>
            <option value="none">Não repete</option>
            <option value="installment">Parcelado</option>
            <option value="recurrence">Recorrente</option>
          </SelectField>
          {repeat === 'installment' && (
            <FormField
              label="Parcelas"
              inputMode="numeric"
              autoComplete="off"
              error={errors.installments?.message}
              {...register('installments')}
            />
          )}
          {repeat === 'installment' && split && (
            <p className="col-span-2 text-xs text-muted-foreground">
              {split.first === split.others
                ? `${installments} parcelas mensais de ${formatBRL(split.others)}.`
                : `${installments} parcelas mensais: a primeira de ${formatBRL(split.first)} e as demais de ${formatBRL(split.others)}.`}{' '}
              {paid ? 'Só a primeira nasce paga.' : ''}
            </p>
          )}
          {repeat === 'recurrence' && (
            <SelectField label="Frequência" {...register('frequency')}>
              {FREQUENCIES.map((frequency) => (
                <option key={frequency.value} value={frequency.value}>
                  {frequency.label}
                </option>
              ))}
            </SelectField>
          )}
          {repeat === 'recurrence' && (
            <p className="col-span-2 text-xs text-muted-foreground">
              Cria 12 lançamentos de uma vez. {paid ? 'Só o primeiro nasce pago; os demais ficam pendentes. ' : ''}
              Depois você pode estender a recorrência.
            </p>
          )}
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor={notesId}>Observação (opcional)</Label>
        <textarea
          id={notesId}
          rows={2}
          aria-invalid={errors.notes ? true : undefined}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30"
          {...register('notes')}
        />
        {errors.notes && <p className="text-sm text-destructive">{errors.notes.message}</p>}
      </div>

      {inSeries && (
        <fieldset className="grid gap-2 rounded-lg border p-3">
          <legend className="px-1 text-sm font-medium">Aplicar a alteração</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" value="one" className="size-4 accent-primary" {...register('scope')} />
            Só a este
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" value="following" className="size-4 accent-primary" {...register('scope')} />
            A este e aos próximos
          </label>
          <p className="text-xs text-muted-foreground">
            Dos próximos, só os pendentes mudam. Vencimento e pagamento valem só para este.
          </p>
        </fieldset>
      )}

      {formError && <ErrorMessage>{formError}</ErrorMessage>}
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? 'Salvando…' : transaction ? 'Salvar' : 'Criar lançamento'}
      </Button>
    </form>
  )
}
