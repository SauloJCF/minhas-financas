import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Account } from '@/accounts/api'
import { parseProposal } from '@/assistant/proposal'
import type { Category } from '@/categories/api'
import { db } from '@/test/fake-supabase'
import { brl, renderAt } from '@/test/render'

vi.mock('@/lib/supabase', () => import('@/test/fake-supabase'))

const MODELS = {
  data: [
    { id: 'acme/pago', name: 'Acme Pago', pricing: { prompt: '0.000001', completion: '0.000002' }, supported_parameters: ['tools'] },
    { id: 'acme/gratis:free', name: 'Acme Grátis', pricing: { prompt: '0', completion: '0' }, supported_parameters: ['tools'] },
    { id: 'acme/mudo:free', name: 'Sem Ferramentas', pricing: { prompt: '0', completion: '0' }, supported_parameters: ['temperature'] },
  ],
}

type Call = { url: string; headers: Record<string, string>; body: { model: string; messages: { role: string; content: string }[] } }

/**
 * OpenRouter falso: a lista de modelos é fixa, e cada chamada ao chat consome a próxima
 * resposta da fila. Um número na fila é o status de um erro.
 */
function fakeOpenRouter(replies: (Record<string, unknown> | number)[] = []) {
  const calls: Call[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === 'https://openrouter.ai/api/v1/models') return new Response(JSON.stringify(MODELS))
      if (url !== 'https://openrouter.ai/api/v1/chat/completions') throw new Error(`chamada inesperada: ${url}`)
      calls.push({ url, headers: init!.headers as Record<string, string>, body: JSON.parse(init!.body as string) })
      const reply = replies.shift()
      if (reply === undefined) throw new Error('o teste não previu esta chamada ao chat')
      if (typeof reply === 'number') return new Response('{}', { status: reply })
      return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', ...reply } }] }))
    }),
  )
  return calls
}

const toolCall = (id: string, args: Record<string, unknown>) => ({
  content: null,
  tool_calls: [{ id, type: 'function', function: { name: 'create_transaction', arguments: JSON.stringify(args) } }],
})

const mercado = {
  type: 'expense',
  description: 'Mercado',
  amount: 45.9,
  account_id: 'nubank',
  category_id: 'food',
  due_date: '2026-11-15',
  paid: true,
}

const accounts = [
  { id: 'nubank', name: 'Nubank', type: 'corrente', initial_balance: 0, initial_balance_date: '2026-01-01', color: '#9333ea', icon: 'landmark', archived: false },
  { id: 'card', name: 'Cartão', type: 'cartao', initial_balance: 0, initial_balance_date: '2026-01-01', color: '#9333ea', icon: 'credit-card', archived: false },
]
const categories = [
  { id: 'food', name: 'Alimentação', type: 'expense', color: '#ea580c', icon: 'utensils', archived: false },
  { id: 'salary', name: 'Salário', type: 'income', color: '#059669', icon: 'briefcase', archived: false },
]
const context = {
  accounts: accounts as unknown as Account[],
  categories: categories as unknown as Category[],
  today: '2026-11-16',
}
const parse = (args: Record<string, unknown>) => parseProposal(JSON.stringify(args), context)

beforeEach(() => {
  // Só o relógio: hoje é 16/11/2026.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 16, 12))

  db.reset()
  db.tables.accounts = accounts.map((account) => ({ ...account }))
  db.tables.categories = categories.map((category) => ({ ...category }))
  db.tables.assistant_settings = [{ user_id: 'ana', openrouter_key: 'sk-or-teste', model: 'acme/gratis:free', free_only: true }]
})

afterEach(() => vi.useRealTimers())

test('a proposta vira um lançamento em centavos, pago na data em que aconteceu', () => {
  expect(parse(mercado)).toEqual({
    ok: true,
    values: {
      type: 'expense',
      description: 'Mercado',
      amount: 4590,
      account_id: 'nubank',
      category_id: 'food',
      due_date: '2026-11-15',
      paid_at: '2026-11-15',
      notes: null,
    },
  })
})

test('a proposta aceita valor escrito à brasileira, nome no lugar do id e deduz o pagamento pela data', () => {
  const future = parse({ ...mercado, amount: '1.234,56', account_id: 'nubank', category_id: 'alimentação', due_date: '2026-12-01', paid: undefined })
  expect(future).toMatchObject({ ok: true, values: { amount: 123456, category_id: 'food', paid_at: null } })

  const past = parse({ ...mercado, paid: undefined })
  expect(past).toMatchObject({ ok: true, values: { paid_at: '2026-11-15' } })
})

test('compra no cartão nasce paga, mesmo que o modelo diga pendente', () => {
  expect(parse({ ...mercado, account_id: 'card', paid: false })).toMatchObject({ ok: true, values: { paid_at: '2026-11-15' } })
})

test('proposta com valor, conta, categoria ou data errados é recusada', () => {
  expect(parse({ ...mercado, amount: 0 }).ok).toBe(false)
  expect(parse({ ...mercado, amount: 'muito' }).ok).toBe(false)
  expect(parse({ ...mercado, account_id: 'itau' }).ok).toBe(false)
  // Categoria de receita em uma despesa.
  expect(parse({ ...mercado, category_id: 'salary' }).ok).toBe(false)
  expect(parse({ ...mercado, due_date: '15/11/2026' }).ok).toBe(false)
  expect(parse({ ...mercado, description: undefined })).toEqual({ ok: false, error: 'Argumentos inválidos ou ausentes: description.' })
  expect(parseProposal('{isso não é json', context).ok).toBe(false)
})

const modelOptions = () =>
  within(screen.getByLabelText('Modelo'))
    .getAllByRole('option')
    .map((option) => option.textContent)

test('perfil: a caixa de só gratuitos filtra os modelos, e as configurações ficam salvas', async () => {
  db.tables.assistant_settings = []
  fakeOpenRouter()
  const user = renderAt('/perfil')

  expect(await screen.findByLabelText('Mostrar só modelos gratuitos')).toBeChecked()
  // Modelo sem suporte a ferramentas nunca entra.
  expect(modelOptions()).toEqual(['Escolha…', 'Acme Grátis (gratuito)'])

  await user.click(screen.getByLabelText('Mostrar só modelos gratuitos'))
  expect(modelOptions()).toHaveLength(3)
  expect(modelOptions()[2]).toMatch(/^Acme Pago \(US\$\s1,00 \+ US\$\s2,00 por milhão de tokens\)$/)

  await user.type(screen.getByLabelText('Chave do OpenRouter'), ' sk-or-nova ')
  await user.selectOptions(screen.getByLabelText('Modelo'), 'acme/pago')
  await user.click(screen.getByRole('button', { name: 'Salvar' }))

  expect(await screen.findByText('Configurações salvas.')).toBeInTheDocument()
  expect(db.tables.assistant_settings).toMatchObject([{ openrouter_key: 'sk-or-nova', model: 'acme/pago', free_only: false }])

  // Voltar para só gratuitos desfaz a escolha de um modelo pago.
  await user.click(screen.getByLabelText('Mostrar só modelos gratuitos'))
  expect(screen.getByLabelText('Modelo')).toHaveValue('')
})

test('perfil: mostra o que está salvo e remove a chave', async () => {
  fakeOpenRouter()
  const user = renderAt('/perfil')

  expect(await screen.findByLabelText('Chave do OpenRouter')).toHaveValue('sk-or-teste')
  expect(screen.getByLabelText('Chave do OpenRouter')).toHaveAttribute('type', 'password')
  expect(screen.getByLabelText('Modelo')).toHaveValue('acme/gratis:free')

  await user.click(screen.getByRole('button', { name: 'Remover chave' }))
  expect(await screen.findByText('Configurações salvas.')).toBeInTheDocument()
  expect(db.tables.assistant_settings).toMatchObject([{ openrouter_key: null, model: 'acme/gratis:free' }])
})

test('sem chave configurada, o assistente manda para o perfil', async () => {
  db.tables.assistant_settings = []
  const user = renderAt('/lancamentos')
  await user.click(await screen.findByRole('link', { name: 'Assistente' }))

  expect(await screen.findByText(/informe a sua chave do OpenRouter/)).toBeInTheDocument()
  expect(screen.queryByLabelText('Mensagem')).not.toBeInTheDocument()
  // O link do texto, não o do menu.
  await user.click(within(screen.getByRole('main')).getByRole('link', { name: 'Perfil' }))
  expect(await screen.findByRole('heading', { name: 'Perfil' })).toBeInTheDocument()
})

test('o assistente propõe, e só o Confirmar grava o lançamento', async () => {
  const calls = fakeOpenRouter([toolCall('call-1', mercado), { content: 'Mais alguma coisa?' }])
  const user = renderAt('/assistente')

  await user.type(await screen.findByLabelText('Mensagem'), 'gastei 45,90 no mercado ontem')
  await user.click(screen.getByRole('button', { name: 'Enviar' }))

  const card = await screen.findByRole('article', { name: 'Proposta: Mercado' })
  expect(within(card).getByText('Despesa')).toBeInTheDocument()
  expect(within(card).getByText(brl(4590))).toBeInTheDocument()
  expect(within(card).getByText('Nubank')).toBeInTheDocument()
  expect(within(card).getByText('Alimentação')).toBeInTheDocument()
  expect(within(card).getByText('15/11/2026')).toBeInTheDocument()
  expect(within(card).getByText('Pago em 15/11/2026')).toBeInTheDocument()
  // Enquanto o usuário não confirma, nada existe.
  expect(db.tables.transactions).toHaveLength(0)

  // A chave vai só no cabeçalho, para o OpenRouter; o modelo recebe as contas e categorias.
  expect(calls[0].headers.Authorization).toBe('Bearer sk-or-teste')
  expect(calls[0].body.model).toBe('acme/gratis:free')
  expect(JSON.stringify(calls[0].body)).not.toContain('sk-or-teste')
  expect(calls[0].body.messages[0].content).toContain('nubank: Nubank (Conta corrente)')
  expect(calls[0].body.messages[0].content).toContain('Hoje é segunda-feira, 2026-11-16')
  expect(calls[0].body.messages[1]).toEqual({ role: 'user', content: 'gastei 45,90 no mercado ontem' })

  await user.click(within(card).getByRole('button', { name: 'Confirmar' }))
  expect(await within(card).findByText('Lançamento criado.')).toBeInTheDocument()
  expect(within(card).queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument()
  expect(db.tables.transactions).toMatchObject([
    { type: 'expense', description: 'Mercado', amount: 4590, account_id: 'nubank', category_id: 'food', due_date: '2026-11-15', paid_at: '2026-11-15', notes: null },
  ])

  // O resultado da ferramenta segue para o modelo com a mensagem seguinte.
  await user.type(screen.getByLabelText('Mensagem'), 'obrigado')
  await user.click(screen.getByRole('button', { name: 'Enviar' }))
  expect(await screen.findByText('Mais alguma coisa?')).toBeInTheDocument()
  expect(calls[1].body.messages.map((message) => message.role)).toEqual(['system', 'user', 'assistant', 'tool', 'user'])
  expect(calls[1].body.messages[3]).toMatchObject({ tool_call_id: 'call-1', content: expect.stringContaining('criado') })
})

test('descartar não grava nada', async () => {
  const calls = fakeOpenRouter([toolCall('call-1', mercado), { content: 'Certo.' }])
  const user = renderAt('/assistente')

  await user.type(await screen.findByLabelText('Mensagem'), 'gastei 45,90 no mercado ontem')
  await user.click(screen.getByRole('button', { name: 'Enviar' }))
  const card = await screen.findByRole('article', { name: 'Proposta: Mercado' })

  await user.click(within(card).getByRole('button', { name: 'Descartar' }))
  expect(within(card).getByText('Descartado.')).toBeInTheDocument()
  expect(within(card).queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument()
  expect(db.tables.transactions).toHaveLength(0)

  await user.type(screen.getByLabelText('Mensagem'), 'deixa pra lá')
  await user.click(screen.getByRole('button', { name: 'Enviar' }))
  expect(await screen.findByText('Certo.')).toBeInTheDocument()
  expect(calls[1].body.messages[3]).toMatchObject({ role: 'tool', content: expect.stringContaining('descartado') })
})

test('escrever de novo sem decidir descarta a proposta pendente', async () => {
  const calls = fakeOpenRouter([toolCall('call-1', mercado), toolCall('call-2', { ...mercado, amount: 50 })])
  const user = renderAt('/assistente')

  await user.type(await screen.findByLabelText('Mensagem'), 'gastei 45,90 no mercado ontem')
  await user.click(screen.getByRole('button', { name: 'Enviar' }))
  await screen.findByRole('article', { name: 'Proposta: Mercado' })

  await user.type(screen.getByLabelText('Mensagem'), 'na verdade foram 50')
  await user.click(screen.getByRole('button', { name: 'Enviar' }))

  await waitFor(() => expect(screen.getAllByRole('article', { name: 'Proposta: Mercado' })).toHaveLength(2))
  const [first, second] = screen.getAllByRole('article', { name: 'Proposta: Mercado' })
  expect(within(first).getByText('Descartado.')).toBeInTheDocument()
  expect(within(second).getByText(brl(5000))).toBeInTheDocument()
  expect(calls[1].body.messages[3]).toMatchObject({ role: 'tool', tool_call_id: 'call-1', content: expect.stringContaining('descartado') })
})

test('proposta inválida não vira cartão: o erro volta ao modelo, que corrige', async () => {
  const calls = fakeOpenRouter([toolCall('call-1', { ...mercado, category_id: 'salary' }), toolCall('call-2', mercado)])
  const user = renderAt('/assistente')

  await user.type(await screen.findByLabelText('Mensagem'), 'gastei 45,90 no mercado ontem')
  await user.click(screen.getByRole('button', { name: 'Enviar' }))

  expect(await screen.findByRole('article', { name: 'Proposta: Mercado' })).toBeInTheDocument()
  expect(screen.getAllByRole('article')).toHaveLength(1)
  expect(calls).toHaveLength(2)
  expect(calls[1].body.messages[3]).toMatchObject({ role: 'tool', tool_call_id: 'call-1', content: expect.stringContaining('categoria de despesa') })
})

test('erros do OpenRouter têm mensagem própria, sem a chave, e o texto volta para o campo', async () => {
  const calls = fakeOpenRouter([401, 429, { content: 'Oi!' }])
  const user = renderAt('/assistente')

  await user.type(await screen.findByLabelText('Mensagem'), 'oi')
  await user.click(screen.getByRole('button', { name: 'Enviar' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('O OpenRouter recusou a chave. Confira a chave no Perfil.')
  expect(document.body).not.toHaveTextContent('sk-or-teste')
  expect(screen.getByLabelText('Mensagem')).toHaveValue('oi')

  await user.click(screen.getByRole('button', { name: 'Enviar' }))
  expect(await screen.findByText(/O limite de uso deste modelo foi atingido/)).toBeInTheDocument()

  // A mensagem que falhou não ficou duplicada na conversa.
  await user.click(screen.getByRole('button', { name: 'Enviar' }))
  expect(await screen.findByText('Oi!')).toBeInTheDocument()
  expect(calls[2].body.messages.map((message) => message.role)).toEqual(['system', 'user'])
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
