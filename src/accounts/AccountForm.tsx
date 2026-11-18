import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { ColorField, IconField } from '@/components/ColorIconFields'
import { FormField } from '@/components/FormField'
import { ErrorMessage } from '@/components/FormPage'
import { SelectField } from '@/components/SelectField'
import { Button } from '@/components/ui/button'
import { COLORS } from '@/lib/colors'
import { today } from '@/lib/dates'
import { dbErrorMessage } from '@/lib/db'
import { ACCOUNT_ICONS } from '@/lib/icons'
import { centavosToInput, parseBRL } from '@/lib/money'
import { useOnline } from '@/lib/offline'
import { ACCOUNT_TYPES, type Account, type AccountInput } from './api'

/** Um dia do mês digitado, de 1 a 31; `null` se não for. */
function parseDay(text: string): number | null {
  if (!/^\d{1,2}$/.test(text.trim())) return null
  const day = Number(text)
  return day >= 1 && day <= 31 ? day : null
}

const DAY_MESSAGE = 'Informe um dia de 1 a 31.'

/** O que o formulário guarda: tudo texto, como foi digitado. */
const accountSchema = z
  .object({
    name: z.string().trim().min(1, 'Informe o nome da conta.').max(60, 'Use até 60 caracteres.'),
    type: z.enum(['corrente', 'poupanca', 'dinheiro', 'cartao', 'investimento']),
    initialBalance: z.string().refine((text) => parseBRL(text) !== null, 'Informe um valor, como 1.234,56.'),
    initialBalanceDate: z.iso.date('Informe a data.'),
    color: z.string(),
    icon: z.string(),
    closingDay: z.string(),
    dueDay: z.string(),
  })
  // Só cartão tem ciclo de fatura. Os dois dias são opcionais, mas andam juntos.
  .refine(
    (values) =>
      values.type !== 'cartao' ||
      (!values.closingDay.trim() && !values.dueDay.trim()) ||
      parseDay(values.closingDay) !== null,
    { path: ['closingDay'], message: DAY_MESSAGE },
  )
  .refine(
    (values) =>
      values.type !== 'cartao' ||
      (!values.closingDay.trim() && !values.dueDay.trim()) ||
      parseDay(values.dueDay) !== null,
    { path: ['dueDay'], message: DAY_MESSAGE },
  )
type AccountFormValues = z.infer<typeof accountSchema>

type Props = {
  /** A conta sendo editada; sem ela, o formulário cria uma conta nova. */
  account?: Account
  /** Grava a conta; se lançar, o erro aparece no formulário. */
  onSubmit: (values: AccountInput) => Promise<void>
}

function iconForType(type: string): string {
  return ACCOUNT_TYPES.find((option) => option.value === type)?.icon ?? 'wallet'
}

export function AccountForm({ account, onSubmit }: Props) {
  const [formError, setFormError] = useState<string | null>(null)
  const online = useOnline()
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: account
      ? {
          name: account.name,
          type: account.type,
          initialBalance: centavosToInput(account.initial_balance),
          initialBalanceDate: account.initial_balance_date,
          color: account.color,
          icon: account.icon,
          closingDay: account.closing_day?.toString() ?? '',
          dueDay: account.due_day?.toString() ?? '',
        }
      : {
          name: '',
          type: 'corrente',
          initialBalance: '0,00',
          initialBalanceDate: today(),
          color: COLORS[0].value,
          icon: iconForType('corrente'),
          closingDay: '',
          dueDay: '',
        },
  })
  const isCard = useWatch({ control, name: 'type' }) === 'cartao'

  const submit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await onSubmit({
        name: values.name,
        type: values.type,
        // O schema já garantiu que o texto é um valor.
        initial_balance: parseBRL(values.initialBalance) ?? 0,
        initial_balance_date: values.initialBalanceDate,
        color: values.color,
        icon: values.icon,
        closing_day: values.type === 'cartao' ? parseDay(values.closingDay) : null,
        due_day: values.type === 'cartao' ? parseDay(values.dueDay) : null,
      })
    } catch (error) {
      setFormError(dbErrorMessage(error))
    }
  })

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <FormField label="Nome" autoComplete="off" error={errors.name?.message} {...register('name')} />

      <SelectField
        label="Tipo de conta"
        error={errors.type?.message}
        {...register('type', {
          // Numa conta nova, o ícone acompanha o tipo até a pessoa escolher um.
          onChange: (event) => {
            if (!account && !dirtyFields.icon) setValue('icon', iconForType(event.target.value))
          },
        })}
      >
        {ACCOUNT_TYPES.map((type) => (
          <option key={type.value} value={type.value}>
            {type.label}
          </option>
        ))}
      </SelectField>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Saldo inicial (R$)"
          inputMode="decimal"
          autoComplete="off"
          error={errors.initialBalance?.message}
          {...register('initialBalance')}
        />
        <FormField
          label="Data do saldo inicial"
          type="date"
          error={errors.initialBalanceDate?.message}
          {...register('initialBalanceDate')}
        />
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        Quanto havia na conta nessa data. Em cartão, use um valor negativo para o que já deve.
      </p>

      {isCard && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Dia de fechamento"
              inputMode="numeric"
              autoComplete="off"
              error={errors.closingDay?.message}
              {...register('closingDay')}
            />
            <FormField
              label="Dia de vencimento"
              inputMode="numeric"
              autoComplete="off"
              error={errors.dueDay?.message}
              {...register('dueDay')}
            />
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            Com os dois dias, o app monta a fatura do cartão. Compras feitas no dia do fechamento caem na fatura
            seguinte.
          </p>
        </>
      )}

      <ColorField registration={register('color')} />
      <IconField icons={ACCOUNT_ICONS} registration={register('icon')} />

      {formError && <ErrorMessage>{formError}</ErrorMessage>}
      <Button type="submit" size="lg" disabled={isSubmitting || !online}>
        {isSubmitting ? 'Salvando…' : account ? 'Salvar' : 'Criar conta'}
      </Button>
    </form>
  )
}
