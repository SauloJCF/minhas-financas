import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import { AppRoutes } from './AppRoutes'
import { AuthProvider } from './auth/AuthProvider'

// Supabase falso: `currentSession` decide se o app enxerga alguém logado.
const fake = vi.hoisted(() => {
  const state = { currentSession: null as { user: { email: string } } | null }
  const auth = {
    onAuthStateChange: vi.fn((callback: (event: string, session: unknown) => void) => {
      queueMicrotask(() => callback('INITIAL_SESSION', state.currentSession))
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    }),
    getSession: vi.fn(async () => ({ data: { session: state.currentSession } })),
    signInWithPassword: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    verifyOtp: vi.fn(),
    updateUser: vi.fn(),
    signOut: vi.fn(async () => ({ error: null })),
  }
  return { state, auth }
})

vi.mock('@/lib/supabase', () => ({ supabase: { auth: fake.auth } }))

function renderAt(path: string) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  )
  return userEvent.setup()
}

beforeEach(() => {
  fake.state.currentSession = null
  for (const fn of ['signInWithPassword', 'resetPasswordForEmail', 'verifyOtp', 'updateUser'] as const) {
    fake.auth[fn].mockReset().mockResolvedValue({ error: null })
  }
})

test('sem sessão, o app leva para o login', async () => {
  renderAt('/')
  expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
})

test('com sessão, mostra o app e tira a pessoa da tela de login', async () => {
  fake.state.currentSession = { user: { email: 'ana@example.com' } }
  renderAt('/login')
  expect(await screen.findByRole('heading', { name: 'Início' })).toBeInTheDocument()
})

test('não existe tela de cadastro', async () => {
  renderAt('/cadastro')
  expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
  expect(screen.queryByText(/cadastr|criar conta/i)).not.toBeInTheDocument()
})

test('login com credenciais erradas mostra a mensagem em português', async () => {
  fake.auth.signInWithPassword.mockResolvedValue({ error: { code: 'invalid_credentials' } })
  const user = renderAt('/login')
  await user.type(await screen.findByLabelText('E-mail'), 'ana@example.com')
  await user.type(screen.getByLabelText('Senha'), 'senha-errada')
  await user.click(screen.getByRole('button', { name: 'Entrar' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.')
  expect(fake.auth.signInWithPassword).toHaveBeenCalledWith({
    email: 'ana@example.com',
    password: 'senha-errada',
  })
})

test('login valida o e-mail antes de chamar o servidor', async () => {
  const user = renderAt('/login')
  await user.type(await screen.findByLabelText('E-mail'), 'não-é-email')
  await user.type(screen.getByLabelText('Senha'), 'qualquer')
  await user.click(screen.getByRole('button', { name: 'Entrar' }))

  expect(await screen.findByText('Informe um e-mail válido.')).toBeInTheDocument()
  expect(fake.auth.signInWithPassword).not.toHaveBeenCalled()
})

test('esqueci minha senha confirma o envio sem revelar se o usuário existe', async () => {
  const user = renderAt('/esqueci-senha')
  await user.type(await screen.findByLabelText('E-mail'), 'ana@example.com')
  await user.click(screen.getByRole('button', { name: 'Enviar link' }))

  expect(await screen.findByRole('status')).toHaveTextContent('Se houver um usuário')
  expect(fake.auth.resetPasswordForEmail).toHaveBeenCalledWith('ana@example.com')
})

test('convite: valida o token e grava a senha só ao enviar o formulário', async () => {
  const user = renderAt('/definir-senha?token_hash=abc123&type=invite')
  expect(await screen.findByRole('heading', { name: 'Criar senha' })).toBeInTheDocument()
  expect(fake.auth.verifyOtp).not.toHaveBeenCalled()

  await user.type(screen.getByLabelText('Nova senha'), 'senha-segura-1')
  await user.type(screen.getByLabelText('Repita a senha'), 'senha-segura-1')
  await user.click(screen.getByRole('button', { name: 'Criar senha e entrar' }))

  await vi.waitFor(() => expect(fake.auth.updateUser).toHaveBeenCalledWith({ password: 'senha-segura-1' }))
  expect(fake.auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'abc123', type: 'invite' })
})

test('convite: senhas diferentes ou curtas não são enviadas', async () => {
  const user = renderAt('/definir-senha?token_hash=abc123&type=invite')
  await user.type(await screen.findByLabelText('Nova senha'), 'curta')
  await user.type(screen.getByLabelText('Repita a senha'), 'outra')
  await user.click(screen.getByRole('button', { name: 'Criar senha e entrar' }))

  expect(await screen.findByText('A senha precisa ter pelo menos 8 caracteres.')).toBeInTheDocument()
  expect(screen.getByText('As senhas não são iguais.')).toBeInTheDocument()
  expect(fake.auth.verifyOtp).not.toHaveBeenCalled()
})

test('convite: link expirado mostra o erro e não grava senha', async () => {
  fake.auth.verifyOtp.mockResolvedValue({ error: { code: 'otp_expired' } })
  const user = renderAt('/definir-senha?token_hash=velho&type=recovery')
  await user.type(await screen.findByLabelText('Nova senha'), 'senha-segura-1')
  await user.type(screen.getByLabelText('Repita a senha'), 'senha-segura-1')
  await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Este link expirou ou já foi usado.')
  expect(fake.auth.updateUser).not.toHaveBeenCalled()
})

test('e-mail padrão: quem chega já logado pelo link só define a senha', async () => {
  fake.state.currentSession = { user: { email: 'ana@example.com' } }
  const user = renderAt('/definir-senha?type=invite')
  await user.type(await screen.findByLabelText('Nova senha'), 'senha-segura-1')
  await user.type(screen.getByLabelText('Repita a senha'), 'senha-segura-1')
  await user.click(screen.getByRole('button', { name: 'Criar senha e entrar' }))

  await vi.waitFor(() => expect(fake.auth.updateUser).toHaveBeenCalledWith({ password: 'senha-segura-1' }))
  expect(fake.auth.verifyOtp).not.toHaveBeenCalled()
})

test('e-mail padrão: sem sessão e sem token, a senha não é gravada', async () => {
  const user = renderAt('/definir-senha?type=recovery')
  await user.type(await screen.findByLabelText('Nova senha'), 'senha-segura-1')
  await user.type(screen.getByLabelText('Repita a senha'), 'senha-segura-1')
  await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Este link expirou ou já foi usado.')
  expect(fake.auth.updateUser).not.toHaveBeenCalled()
})

test('link de e-mail expirado mostra link inválido', async () => {
  renderAt('/definir-senha?erro=link')
  expect(await screen.findByRole('heading', { name: 'Link inválido' })).toBeInTheDocument()
})

test('definir senha sem token mostra link inválido', async () => {
  renderAt('/definir-senha')
  expect(await screen.findByRole('heading', { name: 'Link inválido' })).toBeInTheDocument()
})

test('perfil: mostra o e-mail, troca a senha e sai', async () => {
  fake.state.currentSession = { user: { email: 'ana@example.com' } }
  const user = renderAt('/perfil')
  expect(await screen.findByText('ana@example.com')).toBeInTheDocument()

  await user.type(screen.getByLabelText('Nova senha'), 'senha-nova-123')
  await user.type(screen.getByLabelText('Repita a senha'), 'senha-nova-123')
  await user.click(screen.getByRole('button', { name: 'Trocar senha' }))
  expect(await screen.findByText('Senha alterada.')).toBeInTheDocument()
  expect(fake.auth.updateUser).toHaveBeenCalledWith({ password: 'senha-nova-123' })

  await user.click(screen.getByRole('button', { name: 'Sair' }))
  expect(fake.auth.signOut).toHaveBeenCalled()
})
