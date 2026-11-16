import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import { AppRoutes } from './AppRoutes'
import { AuthProvider } from './auth/AuthProvider'
import { formatBRL } from './lib/money'

// O Intl separa 'R$' do número com um espaço não separável; na tela, é um espaço comum.
const saldo = (centavos: number) => formatBRL(centavos).replace(/\s/g, ' ')

type Row = Record<string, unknown>

// Supabase falso: as contas vivem em `rows`, e a view devolve o saldo inicial como saldo atual.
const fake = vi.hoisted(() => {
  const state = {
    rows: [] as Record<string, unknown>[],
    /** Erro devolvido pela próxima exclusão, para simular conta em uso. */
    deleteError: null as { code: string } | null,
    nextId: 1,
  }

  function from(table: string) {
    let run = (): { data: unknown; error: unknown } => ({ data: null, error: null })
    const matches = (filter: [string, unknown] | null) => (row: Record<string, unknown>) =>
      !filter || row[filter[0]] === filter[1]
    let filter: [string, unknown] | null = null

    const builder = {
      select() {
        run = () => ({
          data: state.rows.map((row) => ({ ...row, saldo_atual: row.saldo_inicial })),
          error: null,
        })
        return builder
      },
      order(column: string) {
        const select = run
        run = () => {
          const result = select() as { data: Record<string, unknown>[]; error: null }
          result.data.sort((a, b) => String(a[column]).localeCompare(String(b[column])))
          return result
        }
        return builder
      },
      insert(values: Record<string, unknown>) {
        run = () => {
          state.rows.push({ id: `conta-${state.nextId++}`, arquivada: false, ...values })
          return { data: null, error: null }
        }
        return builder
      },
      update(values: Record<string, unknown>) {
        run = () => {
          state.rows.filter(matches(filter)).forEach((row) => Object.assign(row, values))
          return { data: null, error: null }
        }
        return builder
      },
      delete() {
        run = () => {
          if (state.deleteError) return { data: null, error: state.deleteError }
          state.rows = state.rows.filter((row) => !matches(filter)(row))
          return { data: null, error: null }
        }
        return builder
      },
      eq(column: string, value: unknown) {
        filter = [column, value]
        return builder
      },
      then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
        if (table !== 'contas' && table !== 'contas_com_saldo') throw new Error(`tabela inesperada: ${table}`)
        return Promise.resolve(run()).then(resolve, reject)
      },
    }
    return builder
  }

  const session = { user: { id: 'ana', email: 'ana@example.com' } }
  const auth = {
    onAuthStateChange: vi.fn((callback: (event: string, session: unknown) => void) => {
      queueMicrotask(() => callback('INITIAL_SESSION', session))
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    }),
  }
  return { state, supabase: { auth, from } }
})

vi.mock('@/lib/supabase', () => ({ supabase: fake.supabase }))

function conta(overrides: Row): Row {
  return {
    id: 'conta-x',
    nome: 'Conta',
    tipo: 'corrente',
    saldo_inicial: 0,
    data_saldo_inicial: '2026-11-01',
    cor: '#059669',
    icone: 'landmark',
    arquivada: false,
    ...overrides,
  }
}

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
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
  fake.state.rows = []
  fake.state.deleteError = null
  fake.state.nextId = 1
})

test('a navegação leva às contas e ao perfil, e guarda o lugar das próximas telas', async () => {
  const user = renderAt('/')
  const nav = await screen.findByRole('navigation', { name: 'Principal' })
  expect(within(nav).getByText('Lançamentos')).toHaveAttribute('aria-disabled', 'true')
  expect(within(nav).getByText('Categorias')).toHaveAttribute('aria-disabled', 'true')

  await user.click(within(nav).getByRole('link', { name: 'Contas' }))
  expect(await screen.findByRole('heading', { name: 'Contas' })).toBeInTheDocument()

  await user.click(within(nav).getByRole('link', { name: 'Perfil' }))
  expect(await screen.findByRole('heading', { name: 'Perfil' })).toBeInTheDocument()
})

test('sem contas, a lista convida a criar a primeira', async () => {
  renderAt('/contas')
  expect(await screen.findByText(/Nenhuma conta ainda/)).toBeInTheDocument()
})

test('a lista agrupa por tipo de conta e mostra o saldo atual de cada uma', async () => {
  fake.state.rows = [
    conta({ id: 'a', nome: 'Nubank', tipo: 'corrente', saldo_inicial: 123456 }),
    conta({ id: 'b', nome: 'Visa', tipo: 'cartao', saldo_inicial: -50000 }),
    conta({ id: 'c', nome: 'Banco antigo', tipo: 'corrente', arquivada: true }),
  ]
  renderAt('/contas')

  const correntes = (await screen.findByRole('heading', { name: 'Contas correntes' })).closest('section')!
  expect(within(correntes).getByRole('link', { name: /Nubank/ })).toHaveTextContent(saldo(123456))
  expect(within(correntes).queryByText('Banco antigo')).not.toBeInTheDocument()

  const cartoes = screen.getByRole('heading', { name: 'Cartões' }).closest('section')!
  expect(within(cartoes).getByRole('link', { name: /Visa/ })).toHaveTextContent(saldo(-50000))

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

  expect(await screen.findByRole('link', { name: /Carteira/ })).toHaveTextContent(saldo(123456))
  expect(fake.state.rows).toEqual([
    expect.objectContaining({
      nome: 'Carteira',
      tipo: 'dinheiro',
      saldo_inicial: 123456,
      cor: '#0284c7',
      // O ícone acompanhou o tipo, porque ninguém escolheu outro.
      icone: 'wallet',
    }),
  ])
  // O dono da conta é decidido pelo banco, não pelo front.
  expect(fake.state.rows[0]).not.toHaveProperty('user_id')
})

test('criar conta valida nome e saldo antes de chamar o servidor', async () => {
  const user = renderAt('/contas/nova')
  await user.clear(await screen.findByLabelText('Saldo inicial (R$)'))
  await user.type(screen.getByLabelText('Saldo inicial (R$)'), 'muito')
  await user.click(screen.getByRole('button', { name: 'Criar conta' }))

  expect(await screen.findByText('Informe o nome da conta.')).toBeInTheDocument()
  expect(screen.getByText('Informe um valor, como 1.234,56.')).toBeInTheDocument()
  expect(fake.state.rows).toEqual([])
})

test('editar conta abre com os valores atuais e grava as mudanças', async () => {
  fake.state.rows = [conta({ id: 'a', nome: 'Visa', tipo: 'cartao', saldo_inicial: -50000, icone: 'credit-card' })]
  const user = renderAt('/contas')
  await user.click(await screen.findByRole('link', { name: /Visa/ }))

  const nome = await screen.findByLabelText('Nome')
  expect(nome).toHaveValue('Visa')
  expect(screen.getByLabelText('Saldo inicial (R$)')).toHaveValue('-500,00')
  expect(screen.getByLabelText('Tipo de conta')).toHaveValue('cartao')

  await user.clear(nome)
  await user.type(nome, 'Visa Platinum')
  await user.click(screen.getByRole('button', { name: 'Salvar' }))

  expect(await screen.findByRole('link', { name: /Visa Platinum/ })).toBeInTheDocument()
  expect(fake.state.rows[0]).toMatchObject({ id: 'a', nome: 'Visa Platinum', saldo_inicial: -50000 })
})

test('arquivar tira a conta da lista principal, e desarquivar a traz de volta', async () => {
  fake.state.rows = [conta({ id: 'a', nome: 'Poupança velha', tipo: 'poupanca' })]
  const user = renderAt('/contas/a')
  await user.click(await screen.findByRole('button', { name: 'Arquivar' }))

  expect(await screen.findByText('Arquivadas (1)')).toBeInTheDocument()
  expect(screen.getByText('Todas as suas contas estão arquivadas.')).toBeInTheDocument()
  expect(fake.state.rows[0]).toMatchObject({ arquivada: true })

  await user.click(screen.getByRole('link', { name: /Poupança velha/ }))
  await user.click(await screen.findByRole('button', { name: 'Desarquivar' }))

  expect(await screen.findByRole('heading', { name: 'Poupanças' })).toBeInTheDocument()
  expect(fake.state.rows[0]).toMatchObject({ arquivada: false })
})

test('excluir pede confirmação antes de apagar a conta', async () => {
  fake.state.rows = [conta({ id: 'a', nome: 'Teste' })]
  const user = renderAt('/contas/a')
  await user.click(await screen.findByRole('button', { name: 'Excluir' }))
  expect(fake.state.rows).toHaveLength(1)

  await user.click(screen.getByRole('button', { name: 'Sim, excluir' }))
  expect(await screen.findByText(/Nenhuma conta ainda/)).toBeInTheDocument()
  expect(fake.state.rows).toEqual([])
})

test('conta em uso não é excluída: o app manda arquivar', async () => {
  fake.state.rows = [conta({ id: 'a', nome: 'Em uso' })]
  fake.state.deleteError = { code: '23503' }
  const user = renderAt('/contas/a')
  await user.click(await screen.findByRole('button', { name: 'Excluir' }))
  await user.click(screen.getByRole('button', { name: 'Sim, excluir' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('não pode ser excluída. Arquive-a.')
  expect(fake.state.rows).toHaveLength(1)
})

test('conta que não existe (ou é de outro usuário) aparece como não encontrada', async () => {
  renderAt('/contas/nao-existe')
  expect(await screen.findByRole('alert')).toHaveTextContent('Conta não encontrada.')
})
