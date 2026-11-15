import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { authErrorMessage } from '@/auth/errors'
import { loginSchema, type LoginValues } from '@/auth/schemas'
import { AuthLayout } from '@/components/AuthLayout'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'

export function Login() {
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  // Ao entrar, o AuthProvider recebe a sessão e a rota redireciona sozinha.
  const submit = handleSubmit(async (values) => {
    setFormError(null)
    const { error } = await supabase.auth.signInWithPassword(values)
    if (error) setFormError(authErrorMessage(error))
  })

  return (
    <AuthLayout title="Entrar" description="O acesso é só por convite.">
      <form onSubmit={submit} noValidate className="grid gap-4">
        <FormField
          label="E-mail"
          type="email"
          autoComplete="email"
          inputMode="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <FormField
          label="Senha"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
      <Link to="/esqueci-senha" className="text-center text-sm text-muted-foreground underline">
        Esqueci minha senha
      </Link>
    </AuthLayout>
  )
}
