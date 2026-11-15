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
 * Destino dos links de convite e de recuperação de senha. Aceita os dois formatos:
 *
 * - E-mail padrão do Supabase: a pessoa já chega com sessão (ver `routeEmailLink`)
 *   e a URL traz só `?type=`.
 * - Modelo personalizado (exige SMTP próprio): a URL traz `?token_hash=`, que só é
 *   gasto ao enviar o formulário, para que leitores de e-mail que pré-carregam links
 *   não inutilizem o convite.
 */
export function SetPassword() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const tokenHash = params.get('token_hash')
  const type = params.get('type')

  if (params.has('erro') || (type !== 'invite' && type !== 'recovery')) {
    return (
      <AuthLayout title="Link inválido">
        <p className="text-sm">
          Este link expirou, já foi usado ou está incompleto. Peça um novo convite ou redefina sua
          senha.
        </p>
        <Link to="/esqueci-senha" className="text-center text-sm text-muted-foreground underline">
          Esqueci minha senha
        </Link>
        <Link to="/login" className="text-center text-sm text-muted-foreground underline">
          Voltar para o login
        </Link>
      </AuthLayout>
    )
  }

  const copy = COPY[type]
  const linkType = type

  async function save(password: string) {
    const { data } = await supabase.auth.getSession()
    if (!data.session) {
      // Sem sessão e sem token não há como provar quem é: o link não vale mais.
      if (!tokenHash) throw Object.assign(new Error('link expirado'), { code: 'otp_expired' })
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: linkType })
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
