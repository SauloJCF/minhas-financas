import { Link, useNavigate, useSearchParams } from 'react-router'
import { AuthLayout } from '@/components/AuthLayout'
import { NewPasswordForm } from '@/components/NewPasswordForm'
import { supabase } from '@/lib/supabase'

const COPY = {
  invite: {
    title: 'Criar senha',
    description: 'Bem-vindo! Escolha uma senha para ativar sua conta.',
    submit: 'Criar senha e entrar',
  },
  recovery: {
    title: 'Nova senha',
    description: 'Escolha uma nova senha para sua conta.',
    submit: 'Salvar nova senha',
  },
} as const

/**
 * Destino dos links de convite e de recuperação de senha.
 *
 * O token do e-mail só é gasto quando a pessoa envia o formulário, não ao abrir a
 * página: assim, leitores de e-mail que pré-carregam links não inutilizam o convite.
 */
export function SetPassword() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const tokenHash = params.get('token_hash')
  const type = params.get('type')

  if (!tokenHash || (type !== 'invite' && type !== 'recovery')) {
    return (
      <AuthLayout title="Link inválido">
        <p className="text-sm">
          Este link está incompleto. Abra de novo o link do e-mail ou peça um novo.
        </p>
        <Link to="/login" className="text-center text-sm text-muted-foreground underline">
          Voltar para o login
        </Link>
      </AuthLayout>
    )
  }

  const copy = COPY[type]

  async function save(password: string) {
    // Se a primeira tentativa já validou o token e só a senha falhou, a sessão existe.
    const { data } = await supabase.auth.getSession()
    if (!data.session) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: type as 'invite' | 'recovery' })
      if (error) throw error
    }
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
    await navigate('/', { replace: true })
  }

  return (
    <AuthLayout title={copy.title} description={copy.description}>
      <NewPasswordForm submitLabel={copy.submit} onSubmit={save} />
    </AuthLayout>
  )
}
