// A parte do servidor MCP que não depende do banco nem do protocolo: o formato dos argumentos
// das ferramentas, a conferência do que o modelo manda e as contas do resumo do mês.
import { z } from 'zod'
import type { Tables } from '../src/lib/database.types.ts'
import { parseBRL } from '../src/lib/money.ts'

export type Account = Pick<Tables<'accounts'>, 'id' | 'name' | 'type'>
export type Category = Pick<Tables<'categories'>, 'id' | 'name' | 'type'>
export type Transaction = Tables<'transactions'>

/** O banco guarda centavos; as ferramentas falam em reais, que é o que um modelo lê sem errar. */
export function toReais(centavos: number): number {
  return centavos / 100
}

/** Valor em reais vindo do modelo (45.9 ou "45,90") para centavos; `null` se não for positivo. */
export function toCentavos(amount: number | string): number | null {
  const centavos = typeof amount === 'number' ? Math.round(amount * 100) : parseBRL(amount)
  return centavos !== null && Number.isSafeInteger(centavos) && centavos > 0 ? centavos : null
}

/** Acha pelo id ou, se o modelo mandou o nome no lugar, pelo nome. */
export function findByIdOrName<T extends { id: string; name: string }>(items: T[], reference: string): T | undefined {
  const wanted = reference.trim().toLowerCase()
  return items.find((item) => item.id === reference) ?? items.find((item) => item.name.toLowerCase() === wanted)
}

const date = z.iso.date().describe('Data no formato AAAA-MM-DD.')
const transactionType = z.enum(['expense', 'income']).describe('expense para despesa, income para receita.')

// Os argumentos de cada ferramenta. O SDK transforma isto no JSON Schema que o cliente vê,
// e confere a chamada antes de ela chegar ao servidor.

export const listTransactionsShape = {
  from: date.describe('Primeiro vencimento do período, AAAA-MM-DD.'),
  to: date.describe('Último vencimento do período, inclusive, AAAA-MM-DD.'),
  account: z.string().optional().describe('Id ou nome de uma conta, para ver só os lançamentos dela.'),
  category: z.string().optional().describe('Id ou nome de uma categoria.'),
  type: transactionType.optional(),
  status: z.enum(['paid', 'pending']).optional().describe('paid para pagos, pending para pendentes.'),
}

export const monthSummaryShape = {
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .describe('O mês-calendário, no formato AAAA-MM.'),
}

export const createTransactionShape = {
  type: transactionType,
  description: z.string().trim().min(1).max(100).describe('Descrição curta, como "Mercado" ou "Salário".'),
  amount: z.union([z.number(), z.string()]).describe('Valor em reais, positivo, com ponto decimal. Exemplo: 45.9'),
  account: z.string().describe('Id ou nome de uma conta não arquivada (ver list_accounts).'),
  category: z.string().describe('Id ou nome de uma categoria não arquivada, do mesmo tipo do lançamento (ver list_categories).'),
  due_date: date.describe('Vencimento, ou a data em que aconteceu, AAAA-MM-DD.'),
  paid: z.boolean().optional().describe('true se já foi pago ou recebido; false se está pendente. Sem isto, vale pago quando o vencimento não é futuro.'),
  notes: z.string().trim().max(500).optional().describe('Observação opcional.'),
}

export type CreateTransactionArgs = z.infer<z.ZodObject<typeof createTransactionShape>>

export type NewTransaction = Pick<
  Transaction,
  'type' | 'description' | 'amount' | 'account_id' | 'category_id' | 'due_date' | 'paid_at' | 'notes'
>

export type Checked<T> = { ok: true; values: T } | { ok: false; error: string }

/**
 * Confere uma chamada de `create_transaction` contra as contas e categorias não arquivadas
 * do usuário. As regras são as do assistente do app (`src/assistant/proposal.ts`). O erro é
 * escrito para o modelo, que pode corrigir a chamada ou perguntar ao usuário.
 */
export function checkNewTransaction(
  args: CreateTransactionArgs,
  context: { accounts: Account[]; categories: Category[]; today: string },
): Checked<NewTransaction> {
  const amount = toCentavos(args.amount)
  if (amount === null) return { ok: false, error: 'amount precisa ser um valor positivo em reais. Se o usuário não disse o valor, pergunte.' }

  const account = findByIdOrName(context.accounts, args.account)
  if (!account) return { ok: false, error: 'account não é de nenhuma conta não arquivada. Use list_accounts ou pergunte qual conta.' }

  const kind = args.type === 'income' ? 'receita' : 'despesa'
  const category = findByIdOrName(
    context.categories.filter((item) => item.type === args.type),
    args.category,
  )
  if (!category) return { ok: false, error: `category não é de nenhuma categoria de ${kind} não arquivada. Use list_categories.` }

  // Compra no cartão já nasce paga, como no formulário: entra na dívida do cartão na data da compra.
  const paid = account.type === 'cartao' || (args.paid ?? args.due_date <= context.today)
  return {
    ok: true,
    values: {
      type: args.type,
      description: args.description,
      amount,
      account_id: account.id,
      category_id: category.id,
      due_date: args.due_date,
      paid_at: paid ? args.due_date : null,
      notes: args.notes || null,
    },
  }
}

type Names = { accounts: Account[]; categories: Category[] }

/** Um lançamento como as ferramentas o devolvem: valor em reais e nomes no lugar dos ids. */
export function presentTransaction(transaction: Transaction, { accounts, categories }: Names) {
  return {
    id: transaction.id,
    type: transaction.type,
    description: transaction.description,
    amount: toReais(transaction.amount),
    account: accounts.find((account) => account.id === transaction.account_id)?.name ?? transaction.account_id,
    category: categories.find((category) => category.id === transaction.category_id)?.name ?? transaction.category_id,
    due_date: transaction.due_date,
    paid_at: transaction.paid_at,
    status: transaction.paid_at ? 'paid' : 'pending',
    notes: transaction.notes,
  }
}

/**
 * Receitas, despesas e resultado de um conjunto de lançamentos, em reais, mais as despesas por
 * categoria, da maior para a menor. A regra é a dos relatórios do app: pagos e pendentes contam.
 */
export function summarize(transactions: Pick<Transaction, 'type' | 'amount' | 'category_id'>[], categories: Category[]) {
  let income = 0
  let expense = 0
  const byCategory = new Map<string, number>()
  for (const transaction of transactions) {
    if (transaction.type === 'income') {
      income += transaction.amount
      continue
    }
    expense += transaction.amount
    byCategory.set(transaction.category_id, (byCategory.get(transaction.category_id) ?? 0) + transaction.amount)
  }
  const names = new Map(categories.map((category) => [category.id, category.name]))
  return {
    income: toReais(income),
    expense: toReais(expense),
    result: toReais(income - expense),
    expenses_by_category: [...byCategory.entries()]
      .map(([id, amount]) => ({ category: names.get(id) ?? 'Sem categoria', amount }))
      .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category))
      .map(({ category, amount }) => ({ category, amount: toReais(amount) })),
  }
}

/** Só endereços da própria máquina: o servidor nunca fala com o Supabase de produção. */
export function isLocalUrl(url: string): boolean {
  try {
    return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)
  } catch {
    return false
  }
}
