// Servidor MCP local: oferece a um cliente MCP (Claude Code, Claude Desktop) ferramentas para
// consultar e criar lançamentos no Supabase LOCAL. Ver docs/adr/0009.
//
// O transporte é stdio: o cliente inicia este processo e conversa com ele por stdin/stdout.
// Por isso nada aqui pode escrever em stdout além do protocolo; avisos vão para stderr.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/lib/database.types.ts'
import { monthRange, today } from '../src/lib/dates.ts'
import {
  checkNewTransaction,
  createTransactionShape,
  findByIdOrName,
  isLocalUrl,
  listTransactionsShape,
  monthSummaryShape,
  presentTransaction,
  summarize,
  toReais,
} from './tools.ts'

// Os mesmos valores que o front usa em desenvolvimento (.env.development.local).
const url = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
// O padrão é o usuário de desenvolvimento de supabase/seed.sql, que só existe no banco local.
const email = process.env.MCP_USER_EMAIL ?? 'dev@example.com'
const password = process.env.MCP_USER_PASSWORD ?? 'senha-local-123'

function fail(message: string): never {
  console.error(`[mcp] ${message}`)
  process.exit(1)
}

if (!isLocalUrl(url)) fail(`Este servidor só fala com o Supabase local, e VITE_SUPABASE_URL aponta para ${url}.`)
if (!anonKey) fail('Falta VITE_SUPABASE_ANON_KEY. Copie .env.example para .env.development.local e preencha.')

// Entra como um usuário comum, pela chave `anon`: o RLS vale aqui como vale no front.
const supabase = createClient<Database>(url, anonKey, { auth: { persistSession: false } })
const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
if (signInError) fail(`Não foi possível entrar como ${email}: ${signInError.message}. O Supabase local está no ar (npm run db:start)?`)

/** O resultado de uma ferramenta: um JSON em texto, que é o que o modelo lê. */
function result(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

/** Erro que o modelo pode entender e corrigir. `isError` avisa o cliente que a chamada falhou. */
function failure(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true }
}

async function activeAccounts() {
  const { data, error } = await supabase.from('accounts_with_balance').select('*').eq('archived', false).order('name')
  if (error) throw new Error(error.message)
  // Os tipos gerados dão as colunas de uma view como anuláveis; esta nunca devolve nulo nelas.
  return data.map((account) => ({
    id: account.id!,
    name: account.name!,
    type: account.type!,
    current_balance: account.current_balance!,
    forecast_balance: account.forecast_balance!,
  }))
}

async function activeCategories() {
  const { data, error } = await supabase.from('categories').select('id, name, type').eq('archived', false).order('name')
  if (error) throw new Error(error.message)
  return data
}

/** Para dar nome aos ids: aqui entram também as arquivadas, que lançamentos antigos ainda usam. */
async function allNames() {
  const [accounts, categories] = await Promise.all([
    supabase.from('accounts').select('id, name, type'),
    supabase.from('categories').select('id, name, type'),
  ])
  if (accounts.error) throw new Error(accounts.error.message)
  if (categories.error) throw new Error(categories.error.message)
  return { accounts: accounts.data, categories: categories.data }
}

const server = new McpServer({ name: 'minhas-financas', version: '0.1.0' })

// `readOnlyHint` diz ao cliente que a ferramenta só lê: ele pode liberá-la sem perguntar.
const READ_ONLY = { readOnlyHint: true, openWorldHint: false }

server.registerTool(
  'list_accounts',
  {
    title: 'Listar contas',
    description: 'As contas não arquivadas do usuário, com o tipo, o saldo atual e o saldo previsto, em reais.',
    annotations: READ_ONLY,
  },
  async () => {
    const accounts = await activeAccounts()
    return result(
      accounts.map((account) => ({
        ...account,
        current_balance: toReais(account.current_balance),
        forecast_balance: toReais(account.forecast_balance),
      })),
    )
  },
)

server.registerTool(
  'list_categories',
  {
    title: 'Listar categorias',
    description: 'As categorias não arquivadas do usuário. Cada uma é de receita (income) ou de despesa (expense).',
    annotations: READ_ONLY,
  },
  async () => result(await activeCategories()),
)

server.registerTool(
  'list_transactions',
  {
    title: 'Listar lançamentos',
    description:
      'Os lançamentos (receitas e despesas) com vencimento em um período, em ordem de vencimento, com valores em reais. Transferências entre contas não são lançamentos e não aparecem.',
    inputSchema: listTransactionsShape,
    annotations: READ_ONLY,
  },
  async ({ from, to, account, category, type, status }) => {
    const names = await allNames()
    let query = supabase.from('transactions').select('*').gte('due_date', from).lte('due_date', to)

    if (account) {
      const found = findByIdOrName(names.accounts, account)
      if (!found) return failure('account não é de nenhuma conta do usuário. Use list_accounts.')
      query = query.eq('account_id', found.id)
    }
    if (category) {
      // Duas categorias podem ter o mesmo nome, uma de receita e outra de despesa.
      const sameType = type ? names.categories.filter((item) => item.type === type) : names.categories
      const found = findByIdOrName(sameType, category)
      if (!found) return failure('category não é de nenhuma categoria do usuário. Use list_categories.')
      query = query.eq('category_id', found.id)
    }
    if (type) query = query.eq('type', type)
    if (status === 'paid') query = query.not('paid_at', 'is', null)
    if (status === 'pending') query = query.is('paid_at', null)

    const { data, error } = await query.order('due_date').order('created_at')
    if (error) return failure(error.message)
    return result(data.map((transaction) => presentTransaction(transaction, names)))
  },
)

server.registerTool(
  'month_summary',
  {
    title: 'Resumo do mês',
    description:
      'Receitas, despesas e resultado de um mês-calendário, em reais, mais as despesas por categoria. Cada lançamento conta no mês do seu vencimento, pago ou pendente.',
    inputSchema: monthSummaryShape,
    annotations: READ_ONLY,
  },
  async ({ month }) => {
    const { first, last } = monthRange(month)
    const [names, transactions] = await Promise.all([
      allNames(),
      supabase.from('transactions').select('type, amount, category_id').gte('due_date', first).lte('due_date', last),
    ])
    if (transactions.error) return failure(transactions.error.message)
    return result({ month, ...summarize(transactions.data, names.categories) })
  },
)

server.registerTool(
  'create_transaction',
  {
    title: 'Criar lançamento',
    description:
      'Cria um lançamento (uma receita ou uma despesa) e devolve o que foi gravado. Grava de verdade: só chame quando o usuário pediu para registrar e o valor é conhecido.',
    inputSchema: createTransactionShape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  async (args) => {
    const [accounts, categories] = await Promise.all([activeAccounts(), activeCategories()])
    const checked = checkNewTransaction(args, { accounts, categories, today: today() })
    if (!checked.ok) return failure(checked.error)

    const { data, error } = await supabase.from('transactions').insert(checked.values).select().single()
    if (error) return failure(error.message)
    return result(presentTransaction(data, { accounts, categories }))
  },
)

await server.connect(new StdioServerTransport())
console.error(`[mcp] minhas-financas no ar, como ${email} em ${url}`)
