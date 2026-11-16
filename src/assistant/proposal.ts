// O que o modelo pode pedir: a ferramenta `create_transaction` e a conferência do que ele manda.
// O modelo só propõe; quem grava é o app, depois que o usuário confirma.
import { z } from 'zod'
import { ACCOUNT_TYPES, type Account } from '@/accounts/api'
import type { Category } from '@/categories/api'
import { addDays } from '@/lib/dates'
import { parseBRL } from '@/lib/money'
import type { TransactionInput } from '@/transactions/api'

export const TOOL_NAME = 'create_transaction'

export const CREATE_TRANSACTION_TOOL = {
  type: 'function',
  function: {
    name: TOOL_NAME,
    description:
      'Propõe um lançamento (uma receita ou uma despesa) para o usuário confirmar. O lançamento só é gravado se o usuário confirmar.',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['expense', 'income'], description: 'expense para despesa, income para receita.' },
        description: { type: 'string', description: 'Descrição curta, como "Mercado" ou "Salário". Até 100 caracteres.' },
        amount: { type: 'number', description: 'Valor em reais, positivo, com ponto decimal. Exemplo: 45.9' },
        account_id: { type: 'string', description: 'O id de uma das contas listadas.' },
        category_id: { type: 'string', description: 'O id de uma das categorias listadas, do mesmo tipo do lançamento.' },
        due_date: { type: 'string', description: 'Vencimento, ou a data em que aconteceu, no formato AAAA-MM-DD.' },
        paid: { type: 'boolean', description: 'true se já foi pago ou recebido; false se ainda está pendente.' },
        notes: { type: 'string', description: 'Observação opcional. Até 500 caracteres.' },
      },
      required: ['type', 'description', 'amount', 'account_id', 'category_id', 'due_date'],
    },
  },
} as const

/** O que o modelo precisa saber do usuário para propor um lançamento. */
export type ProposalContext = {
  /** Só as contas e categorias não arquivadas. */
  accounts: Account[]
  categories: Category[]
  today: string
}

const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']

export function systemPrompt({ accounts, categories, today }: ProposalContext): string {
  const [year, month, day] = today.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
  const accountLines = accounts.map((account) => {
    const type = ACCOUNT_TYPES.find((item) => item.value === account.type)?.label ?? account.type
    return `- ${account.id}: ${account.name} (${type})`
  })
  const categoryLines = (type: Category['type']) =>
    categories.filter((category) => category.type === type).map((category) => `- ${category.id}: ${category.name}`)

  return [
    'Você é o assistente de um app de controle financeiro pessoal. Responda sempre em português do Brasil, em poucas palavras.',
    `Seu único trabalho é registrar lançamentos (receitas e despesas) com a ferramenta ${TOOL_NAME}. Você não altera, não exclui e não consulta lançamentos; se pedirem isso, diga que ainda não sabe fazer.`,
    `Hoje é ${weekday}, ${today}. Ontem foi ${addDays(today, -1)}.`,
    'Regras:',
    '- Quando o usuário descrever um gasto ou um ganho, chame a ferramenta. Para vários de uma vez, chame-a uma vez para cada um.',
    '- Use somente os ids das contas e categorias abaixo. A categoria precisa ser do mesmo tipo do lançamento.',
    '- Sem data informada, use hoje. O que já aconteceu vai com paid true; o que ainda vai acontecer, com paid false.',
    '- Se faltar o valor, ou se não der para saber a conta e houver mais de uma, pergunte antes de chamar a ferramenta. Nunca invente valor.',
    '- O usuário confirma ou descarta cada lançamento na tela. Não peça confirmação por texto e não diga que gravou antes do resultado da ferramenta.',
    'Contas:',
    ...accountLines,
    'Categorias de despesa:',
    ...categoryLines('expense'),
    'Categorias de receita:',
    ...categoryLines('income'),
  ].join('\n')
}

const argsSchema = z.object({
  type: z.enum(['expense', 'income']),
  description: z.string().trim().min(1).max(100),
  amount: z.union([z.number(), z.string()]),
  account_id: z.string(),
  category_id: z.string(),
  due_date: z.iso.date(),
  paid: z.boolean().nullish(),
  notes: z.string().trim().max(500).nullish(),
})

/** Valor em reais vindo do modelo (45.9 ou "45,90") para centavos; `null` se não for um valor positivo. */
function toCentavos(amount: number | string): number | null {
  const centavos = typeof amount === 'number' ? Math.round(amount * 100) : parseBRL(amount)
  return centavos !== null && Number.isSafeInteger(centavos) && centavos > 0 ? centavos : null
}

/** Acha pelo id ou, se o modelo mandou o nome no lugar, pelo nome. */
function find<T extends { id: string; name: string }>(items: T[], reference: string): T | undefined {
  const wanted = reference.trim().toLowerCase()
  return items.find((item) => item.id === reference) ?? items.find((item) => item.name.toLowerCase() === wanted)
}

export type ParsedProposal = { ok: true; values: TransactionInput } | { ok: false; error: string }

/**
 * Confere os argumentos de uma chamada de `create_transaction`. O erro é escrito para o
 * modelo, que o recebe como resultado da ferramenta e pode corrigir ou perguntar ao usuário.
 */
export function parseProposal(argsText: string, { accounts, categories, today }: ProposalContext): ParsedProposal {
  let raw: unknown
  try {
    raw = JSON.parse(argsText)
  } catch {
    return { ok: false, error: 'Os argumentos não são um JSON válido.' }
  }
  const parsed = argsSchema.safeParse(raw)
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))].join(', ')
    return { ok: false, error: `Argumentos inválidos ou ausentes: ${fields}.` }
  }
  const args = parsed.data

  const amount = toCentavos(args.amount)
  if (amount === null) return { ok: false, error: 'amount precisa ser um valor positivo em reais. Se o usuário não disse o valor, pergunte.' }

  const account = find(accounts, args.account_id)
  if (!account) return { ok: false, error: 'account_id não é de nenhuma conta listada. Use um dos ids da lista ou pergunte qual conta.' }

  const category = find(
    categories.filter((item) => item.type === args.type),
    args.category_id,
  )
  if (!category) {
    return { ok: false, error: `category_id não é de nenhuma categoria de ${args.type === 'income' ? 'receita' : 'despesa'} listada.` }
  }

  // Compra no cartão já nasce paga, como no formulário: entra na dívida do cartão na data da compra.
  const paid = account.type === 'cartao' || (args.paid ?? args.due_date <= today)
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
