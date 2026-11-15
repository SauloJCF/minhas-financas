import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { authErrorMessage } from '@/auth/errors'
import { newPasswordSchema, type NewPasswordValues } from '@/auth/schemas'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'

type Props = {
  submitLabel: string
  /** Grava a senha; se lançar, o erro aparece no formulário. */
  onSubmit: (password: string) => Promise<void>
}

/** Senha + confirmação, usado ao aceitar convite, redefinir e trocar a senha. */
export function NewPasswordForm({ submitLabel, onSubmit }: Props) {
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NewPasswordValues>({ resolver: zodResolver(newPasswordSchema) })

  const submit = handleSubmit(async ({ password }) => {
    setFormError(null)
    try {
      await onSubmit(password)
      reset()
    } catch (error) {
      setFormError(authErrorMessage(error))
    }
  })

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <FormField
        label="Nova senha"
        type="password"
        autoComplete="new-password"
        error={errors.password?.message}
        {...register('password')}
      />
      <FormField
        label="Repita a senha"
        type="password"
        autoComplete="new-password"
        error={errors.confirm?.message}
        {...register('confirm')}
      />
      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Salvando…' : submitLabel}
      </Button>
    </form>
  )
}
