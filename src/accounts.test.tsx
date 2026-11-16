import { screen, within } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { db } from '@/test/fake-supabase'
import { brl, renderAt } from '@/test/render'

vi.mock('@/lib/supabase', () => import('@/test/fake-supabase'))

function account(overrides: Record<string, unknown>) {
  return {
    id: 'account-x',
    name: 'Conta',
    type: 'corrente',
    initial_balance: 0,
    initial_balance_date: '2026-11-01',
    color: '#059669',
    icon: 'landmark',
    archived: false,
    ...overrides,
  }
}

beforeEach(() => db.reset())

test('a navegação leva a contas, categorias e perfil, e guarda o lugar das próximas telas', async () => {
  const user = renderAt('/')
  const nav = await screen.findByRole('navigation', { name: 'Principal' })
  expect(within(nav).getByText('Lançamentos')).toHaveAttribute('aria-disabled', 'true')

  await user.click(within(nav).getByRole('link', { name: 'Contas' }))
  expect(await screen.findByRole('heading', { name: 'Contas' })).toBeInTheDocument()

  await user.click(within(nav).getByRole('link', { name: 'Categorias' }))
  expect(await screen.findByRole('heading', { name: 'Categorias' })).toBeInTheDocument()

  await user.click(within(nav).getByRole('link', { name: 'Perfil' }))
  expect(await screen.findByRole('heading', { name: 'Perfil' })).toBeInTheDocument()
})

test('sem contas, a lista convida a criar a primeira', async () => {
  renderAt('/contas')
  expect(await screen.findByText(/Nenhuma conta ainda/)).toBeInTheDocument()
})

test('a lista agrupa por tipo de conta e mostra o saldo atual de cada uma', async () => {
  db.tables.accounts = [
    account({ id: 'a', name: 'Nubank', type: 'corrente', initial_balance: 123456 }),
    account({ id: 'b', name: 'Visa', type: 'cartao', initial_balance: -50000 }),
    account({ id: 'c', name: 'Banco antigo', type: 'corrente', archived: true }),
  ]
  renderAt('/contas')

  const correntes = (await screen.findByRole('heading', { name: 'Contas correntes' })).closest('section')!
  expect(within(correntes).getByRole('link', { name: /Nubank/ })).toHaveTextContent(brl(123456))
  expect(within(correntes).queryByText('Banco antigo')).not.toBeInTheDocument()

  const cartoes = screen.getByRole('heading', { name: 'Cartões' }).closest('section')!
  expect(within(cartoes).getByRole('link', { name: /Visa/ })).toHaveTextContent(brl(-50000))

  expect(screen.getByText('Arquivadas (1)')).toBeInTheDocument()
})

test('criar conta grava o saldo inicial em centavos e volta para a lista', async () => {
  const user = renderAt('/contas')
  await user.click(await screen.findByRole('link', { name: 'Nova conta' }))

  await user.type(screen.getByLabelText('Nome'), '  Carteira  ')
  await user.selectOptions(screen.getByLabelText('Tipo de conta'), 'Dinheiro')
  await user.clear(screen.getByLabelText('Saldo inicial (R$)'))
  await user.type(screen.getByLabelText('Saldo inicial (R$)'), '1.234,56')
  await user.click(screen.getByRole('radio', { name: 'Azul' }))
  await user.click(screen.getByRole('button', { name: 'Criar conta' }))

  expect(await screen.findByRole('link', { name: /Carteira/ })).toHaveTextContent(brl(123456))
  expect(db.tables.accounts).toEqual([
    expect.objectContaining({
      name: 'Carteira',
      type: 'dinheiro',
      initial_balance: 123456,
      color: '#0284c7',
      // O ícone acompanhou o tipo, porque ninguém escolheu outro.
      icon: 'wallet',
    }),
  ])
  // O dono da conta é decidido pelo banco, não pelo front.
  expect(db.tables.accounts[0]).not.toHaveProperty('user_id')
})

test('criar conta valida nome e saldo antes de chamar o servidor', async () => {
  const user = renderAt('/contas/nova')
  await user.clear(await screen.findByLabelText('Saldo inicial (R$)'))
  await user.type(screen.getByLabelText('Saldo inicial (R$)'), 'muito')
  await user.click(screen.getByRole('button', { name: 'Criar conta' }))

  expect(await screen.findByText('Informe o nome da conta.')).toBeInTheDocument()
  expect(screen.getByText('Informe um valor, como 1.234,56.')).toBeInTheDocument()
  expect(db.tables.accounts).toEqual([])
})

test('editar conta abre com os valores atuais e grava as mudanças', async () => {
  db.tables.accounts = [
    account({ id: 'a', name: 'Visa', type: 'cartao', initial_balance: -50000, icon: 'credit-card' }),
  ]
  const user = renderAt('/contas')
  await user.click(await screen.findByRole('link', { name: /Visa/ }))

  const name = await screen.findByLabelText('Nome')
  expect(name).toHaveValue('Visa')
  expect(screen.getByLabelText('Saldo inicial (R$)')).toHaveValue('-500,00')
  expect(screen.getByLabelText('Tipo de conta')).toHaveValue('cartao')

  await user.clear(name)
  await user.type(name, 'Visa Platinum')
  await user.click(screen.getByRole('button', { name: 'Salvar' }))

  expect(await screen.findByRole('link', { name: /Visa Platinum/ })).toBeInTheDocument()
  expect(db.tables.accounts[0]).toMatchObject({ id: 'a', name: 'Visa Platinum', initial_balance: -50000 })
})

test('arquivar tira a conta da lista principal, e desarquivar a traz de volta', async () => {
  db.tables.accounts = [account({ id: 'a', name: 'Poupança velha', type: 'poupanca' })]
  const user = renderAt('/contas/a')
  await user.click(await screen.findByRole('button', { name: 'Arquivar' }))

  expect(await screen.findByText('Arquivadas (1)')).toBeInTheDocument()
  expect(screen.getByText('Todas as suas contas estão arquivadas.')).toBeInTheDocument()
  expect(db.tables.accounts[0]).toMatchObject({ archived: true })

  await user.click(screen.getByRole('link', { name: /Poupança velha/ }))
  await user.click(await screen.findByRole('button', { name: 'Desarquivar' }))

  expect(await screen.findByRole('heading', { name: 'Poupanças' })).toBeInTheDocument()
  expect(db.tables.accounts[0]).toMatchObject({ archived: false })
})

test('excluir pede confirmação antes de apagar a conta', async () => {
  db.tables.accounts = [account({ id: 'a', name: 'Teste' })]
  const user = renderAt('/contas/a')
  await user.click(await screen.findByRole('button', { name: 'Excluir' }))
  expect(db.tables.accounts).toHaveLength(1)

  await user.click(screen.getByRole('button', { name: 'Sim, excluir' }))
  expect(await screen.findByText(/Nenhuma conta ainda/)).toBeInTheDocument()
  expect(db.tables.accounts).toEqual([])
})

test('conta em uso não é excluída: o app manda arquivar', async () => {
  db.tables.accounts = [account({ id: 'a', name: 'Em uso' })]
  db.errors['delete:accounts'] = { code: '23503' }
  const user = renderAt('/contas/a')
  await user.click(await screen.findByRole('button', { name: 'Excluir' }))
  await user.click(screen.getByRole('button', { name: 'Sim, excluir' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('não pode ser excluída. Arquive-a.')
  expect(db.tables.accounts).toHaveLength(1)
})

test('conta que não existe (ou é de outro usuário) aparece como não encontrada', async () => {
  renderAt('/contas/nao-existe')
  expect(await screen.findByRole('alert')).toHaveTextContent('Conta não encontrada.')
})
