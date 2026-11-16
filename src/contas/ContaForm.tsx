import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { FormField } from '@/components/FormField'
import { SelectField } from '@/components/SelectField'
import { Button } from '@/components/ui/button'
import { today } from '@/lib/dates'
import { centavosToInput, parseBRL } from '@/lib/money'
import { contaErrorMessage, type Conta, type ContaInput } from './api'
import { CORES_CONTA, ICONES_CONTA, TIPOS_CONTA } from './options'
import { contaSchema, type ContaFormValues } from './schema'

type Props = {
  /** A conta sendo editada; sem ela, o formulário cria uma conta nova. */
  conta?: Conta
  /** Grava a conta; se lançar, o erro aparece no formulário. */
  onSubmit: (values: ContaInput) => Promise<void>
}

function iconeDoTipo(tipo: string): string {
  return TIPOS_CONTA.find((option) => option.value === tipo)?.icone ?? 'wallet'
}

export function ContaForm({ conta, onSubmit }: Props) {
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<ContaFormValues>({
    resolver: zodResolver(contaSchema),
    defaultValues: conta
      ? {
          nome: conta.nome,
          tipo: conta.tipo,
          saldoInicial: centavosToInput(conta.saldo_inicial),
          dataSaldoInicial: conta.data_saldo_inicial,
          cor: conta.cor,
          icone: conta.icone,
        }
      : {
          nome: '',
          tipo: 'corrente',
          saldoInicial: '0,00',
          dataSaldoInicial: today(),
          cor: CORES_CONTA[0].value,
          icone: iconeDoTipo('corrente'),
        },
  })

  const submit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await onSubmit({
        nome: values.nome,
        tipo: values.tipo,
        // O schema já garantiu que o texto é um valor.
        saldo_inicial: parseBRL(values.saldoInicial) ?? 0,
        data_saldo_inicial: values.dataSaldoInicial,
        cor: values.cor,
        icone: values.icone,
      })
    } catch (error) {
      setFormError(contaErrorMessage(error))
    }
  })

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <FormField label="Nome" autoComplete="off" error={errors.nome?.message} {...register('nome')} />

      <SelectField
        label="Tipo de conta"
        error={errors.tipo?.message}
        {...register('tipo', {
          // Numa conta nova, o ícone acompanha o tipo até a pessoa escolher um.
          onChange: (event) => {
            if (!conta && !dirtyFields.icone) setValue('icone', iconeDoTipo(event.target.value))
          },
        })}
      >
        {TIPOS_CONTA.map((tipo) => (
          <option key={tipo.value} value={tipo.value}>
            {tipo.label}
          </option>
        ))}
      </SelectField>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Saldo inicial (R$)"
          inputMode="decimal"
          autoComplete="off"
          error={errors.saldoInicial?.message}
          {...register('saldoInicial')}
        />
        <FormField
          label="Data do saldo inicial"
          type="date"
          error={errors.dataSaldoInicial?.message}
          {...register('dataSaldoInicial')}
        />
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        Quanto havia na conta nessa data. Em cartão, use um valor negativo para o que já deve.
      </p>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Cor</legend>
        <div className="flex flex-wrap gap-2">
          {CORES_CONTA.map((cor) => (
            <label key={cor.value} className="cursor-pointer">
              <input
                type="radio"
                value={cor.value}
                aria-label={cor.label}
                className="peer sr-only"
                {...register('cor')}
              />
              <span
                className="block size-9 rounded-full ring-offset-2 ring-offset-background peer-checked:ring-2 peer-checked:ring-foreground peer-focus-visible:ring-3 peer-focus-visible:ring-ring"
                style={{ backgroundColor: cor.value }}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Ícone</legend>
        <div className="flex flex-wrap gap-2">
          {Object.entries(ICONES_CONTA).map(([key, { label, Icon }]) => (
            <label key={key} className="cursor-pointer">
              <input
                type="radio"
                value={key}
                aria-label={label}
                className="peer sr-only"
                {...register('icone')}
              />
              <span className="flex size-9 items-center justify-center rounded-lg border text-muted-foreground peer-checked:border-foreground peer-checked:bg-muted peer-checked:text-foreground peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50">
                <Icon className="size-5" />
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? 'Salvando…' : conta ? 'Salvar' : 'Criar conta'}
      </Button>
    </form>
  )
}
