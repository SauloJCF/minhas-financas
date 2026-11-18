import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import type { Account } from '@/accounts/api'
import { FormField } from '@/components/FormField'
import { ErrorMessage } from '@/components/FormPage'
import { SelectField } from '@/components/SelectField'
import { Button } from '@/components/ui/button'
import { today } from '@/lib/dates'
import { dbErrorMessage } from '@/lib/db'
import { centavosToInput, parseBRL } from '@/lib/money'
import { useOnline } from '@/lib/offline'
import type { Transfer, TransferInput } from './api'

const transferSchema = z
  .object({
    fromAccountId: z.string().min(1, 'Escolha a conta de origem.'),
    toAccountId: z.string().min(1, 'Escolha a conta de destino.'),
    amount: z.string().refine((text) => (parseBRL(text) ?? 0) > 0, 'Informe um valor maior que zero.'),
    date: z.string().refine((text) => z.iso.date().safeParse(text).success, 'Informe a data.'),
    notes: z.string().trim().max(500, 'Use até 500 caracteres.'),
  })
  .refine((values) => !values.toAccountId || values.fromAccountId !== values.toAccountId, {
    path: ['toAccountId'],
    message: 'Escolha uma conta diferente da de origem.',
  })
type TransferFormValues = z.infer<typeof transferSchema>

type Props = {
  /** A transferência sendo editada; sem ela, o formulário cria uma nova. */
  transfer?: Transfer
  /** Todas as contas do usuário; as arquivadas só aparecem se a transferência já as usa. */
  accounts: Account[]
  /** Grava a transferência; se lançar, o erro aparece no formulário. */
  onSubmit: (values: TransferInput) => Promise<void>
}

export function TransferForm({ transfer, accounts, onSubmit }: Props) {
  const [formError, setFormError] = useState<string | null>(null)
  const offered = accounts.filter(
    (account) =>
      !account.archived || account.id === transfer?.from_account_id || account.id === transfer?.to_account_id,
  )

  const online = useOnline()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: transfer
      ? {
          fromAccountId: transfer.from_account_id,
          toAccountId: transfer.to_account_id,
          amount: centavosToInput(transfer.amount),
          date: transfer.date,
          notes: transfer.notes ?? '',
        }
      : { fromAccountId: '', toAccountId: '', amount: '', date: today(), notes: '' },
  })

  const submit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await onSubmit({
        from_account_id: values.fromAccountId,
        to_account_id: values.toAccountId,
        // O schema já garantiu que o texto é um valor positivo.
        amount: parseBRL(values.amount) ?? 0,
        date: values.date,
        notes: values.notes || null,
      })
    } catch (error) {
      setFormError(dbErrorMessage(error))
    }
  })

  const options = (
    <>
      <option value="">Escolha…</option>
      {offered.map((account) => (
        <option key={account.id} value={account.id}>
          {account.name}
        </option>
      ))}
    </>
  )

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <SelectField label="Conta de origem" error={errors.fromAccountId?.message} {...register('fromAccountId')}>
        {options}
      </SelectField>
      <SelectField label="Conta de destino" error={errors.toAccountId?.message} {...register('toAccountId')}>
        {options}
      </SelectField>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Valor (R$)"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0,00"
          error={errors.amount?.message}
          {...register('amount')}
        />
        <FormField label="Data" type="date" error={errors.date?.message} {...register('date')} />
      </div>

      <FormField
        label="Observação (opcional)"
        autoComplete="off"
        error={errors.notes?.message}
        {...register('notes')}
      />

      {formError && <ErrorMessage>{formError}</ErrorMessage>}
      <Button type="submit" size="lg" disabled={isSubmitting || !online}>
        {isSubmitting ? 'Salvando…' : transfer ? 'Salvar' : 'Transferir'}
      </Button>
    </form>
  )
}
