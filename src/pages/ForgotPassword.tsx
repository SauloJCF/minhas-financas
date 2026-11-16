import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { authErrorMessage } from '@/auth/errors'
import { forgotPasswordSchema, type ForgotPasswordValues } from '@/auth/schemas'
import { AuthLayout } from '@/components/AuthLayout'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'

export function ForgotPassword() {
  const [sent, setSent] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema) })

  const submit = handleSubmit(async ({ email }) => {
    setFormError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) setFormError(authErrorMessage(error))
    else setSent(true)
  })

  const backToLogin = (
    <Link to="/login" className="text-center text-sm text-muted-foreground underline">
      Voltar para o login
    </Link>
  )

  if (sent) {
    return (
      <AuthLayout title="Confira seu e-mail">
        {/* Mesma resposta exista o usuário ou não, para não revelar quem é usuário. */}
        <p role="status" className="text-sm">
          Se houver um usuário com esse e-mail, enviamos um link para redefinir a senha.
        </p>
        {backToLogin}
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Esqueci minha senha"
      description="Informe seu e-mail e enviaremos um link para criar uma nova senha."
    >
      <form onSubmit={submit} noValidate className="grid gap-4">
        <FormField
          label="E-mail"
          type="email"
          autoComplete="email"
          inputMode="email"
          error={errors.email?.message}
          {...register('email')}
        />
        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Enviando…' : 'Enviar link'}
        </Button>
      </form>
      {backToLogin}
    </AuthLayout>
  )
}
