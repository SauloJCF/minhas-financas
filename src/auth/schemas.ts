import { z } from 'zod'

export const MIN_PASSWORD_LENGTH = 8

const email = z.email('Informe um e-mail válido.')

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Informe a senha.'),
})
export type LoginValues = z.infer<typeof loginSchema>

export const forgotPasswordSchema = z.object({ email })
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>

export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`),
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    path: ['confirm'],
    message: 'As senhas não são iguais.',
  })
export type NewPasswordValues = z.infer<typeof newPasswordSchema>
