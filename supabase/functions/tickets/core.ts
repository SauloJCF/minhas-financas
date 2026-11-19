// Regras da Edge Function `tickets`, sem nada de Deno: o Vitest testa este módulo com um
// GitHub falso (core.test.ts). Quem fala com o GitHub de verdade é o `github.ts`.

export const TITLE_MAX = 100
export const BODY_MAX = 5000
/** Tickets em andamento por usuário. */
export const OPEN_LIMIT = 3

export const TICKET_TYPES = ['improvement', 'fix'] as const
export type TicketType = (typeof TICKET_TYPES)[number]

export type Situation = 'analysis' | 'waiting_you' | 'approved' | 'implementing' | 'done' | 'refused'

// Marcadores nos textos da issue. Os de resposta ao usuário valem para as fatias 2 e 3: o
// agente escreve a resposta entre eles, e só esse trecho chega ao app.
export const USER_MARKER = '<!-- minhas-financas:usuario -->'
export const REPLY_START = '<!-- resposta-ao-usuario -->'
export const REPLY_END = '<!-- /resposta-ao-usuario -->'
/** Comentário do administrador que começa assim fica só no GitHub. */
export const INTERNAL_PREFIX = '[interno]'

export const LABEL = {
  ticket: 'ticket',
  triage: 'needs-triage',
  needsInfo: 'needs-info',
  readyAgent: 'ready-for-agent',
  readyHuman: 'ready-for-human',
  wontfix: 'wontfix',
} as const

export type GithubIssue = {
  number: number
  url: string
  state: 'open' | 'closed'
  /** "completed", "not_planned" ou nulo. */
  stateReason: string | null
  labels: string[]
  body: string
  author: string
  createdAt: string
}

export type GithubComment = { id: number; author: string; body: string; createdAt: string }

/** O que a função precisa do GitHub. Os testes trocam por um falso. */
export type Github = {
  createIssue(input: { title: string; body: string; labels: string[] }): Promise<{ number: number }>
  getIssue(number: number): Promise<GithubIssue>
  listComments(number: number): Promise<GithubComment[]>
  addComment(number: number, body: string): Promise<void>
  setLabels(number: number, labels: string[]): Promise<void>
  /** Se há pull request aberta ligada à issue. */
  hasOpenPullRequest(number: number): Promise<boolean>
}

/** Quem é quem no GitHub: o administrador (dono do PAT) e as contas do agente. */
export type Actors = { admin: string; agents: string[] }

/** Os tickets do usuário, lidos com o cliente dele (a RLS vale). */
export type TicketRow = { id: string; issue_number: number; type: TicketType; title: string; created_at: string }
export type TicketStore = {
  /** Do mais novo ao mais antigo. */
  list(): Promise<TicketRow[]>
  get(id: string): Promise<TicketRow | null>
  insert(row: { issue_number: number; type: TicketType; title: string }): Promise<TicketRow>
}

export type Message = {
  id: string
  from: 'user' | 'admin' | 'agent'
  body: string
  createdAt: string
}

export type TicketView = {
  id: string
  type: TicketType
  title: string
  createdAt: string
  issueNumber: number
  issueUrl: string
  situation: Situation
}

export type TicketDetail = TicketView & { messages: Message[]; closed: boolean }

export type ErrorCode = 'invalid' | 'not_found' | 'closed' | 'limit' | 'not_configured' | 'github'

const STATUS: Record<ErrorCode, number> = {
  invalid: 400,
  not_found: 404,
  closed: 409,
  limit: 409,
  not_configured: 503,
  github: 502,
}

/** Erro com mensagem própria para o usuário. Nunca carrega resposta ou token do GitHub. */
export class TicketError extends Error {
  readonly code: ErrorCode
  readonly status: number
  constructor(code: ErrorCode, message: string) {
    super(message)
    this.code = code
    this.status = STATUS[code]
  }
}

export function isClosed(situation: Situation): boolean {
  return situation === 'done' || situation === 'refused'
}

/** A situação do ticket, calculada a partir da issue. */
export function situationOf(issue: GithubIssue, openPullRequest: boolean): Situation {
  if (issue.labels.includes(LABEL.wontfix) || (issue.state === 'closed' && issue.stateReason === 'not_planned')) {
    return 'refused'
  }
  if (issue.state === 'closed') return 'done'
  if (openPullRequest) return 'implementing'
  if (issue.labels.includes(LABEL.readyAgent) || issue.labels.includes(LABEL.readyHuman)) return 'approved'
  if (issue.labels.includes(LABEL.needsInfo)) return 'waiting_you'
  return 'analysis'
}

async function situationFor(github: Github, issue: GithubIssue): Promise<Situation> {
  // A consulta de PR só importa para issue aberta e ainda não recusada.
  const decided = issue.state === 'closed' || issue.labels.includes(LABEL.wontfix)
  return situationOf(issue, decided ? false : await github.hasOpenPullRequest(issue.number))
}

function stripMarker(text: string): string {
  return text.replace(USER_MARKER, '').trim()
}

function agentReply(body: string): string | null {
  const start = body.indexOf(REPLY_START)
  if (start === -1) return null
  const from = start + REPLY_START.length
  const end = body.indexOf(REPLY_END, from)
  if (end === -1) return null
  return body.slice(from, end).trim() || null
}

/**
 * A conversa vista pelo usuário. O marcador de "mensagem do usuário" só vale em texto do
 * administrador: o repositório é público e qualquer um poderia escrevê-lo num comentário.
 */
export function conversation(issue: GithubIssue, comments: GithubComment[], actors: Actors): Message[] {
  const messages: Message[] = []
  const description = stripMarker(issue.body)
  if (issue.author === actors.admin && issue.body.includes(USER_MARKER) && description) {
    messages.push({ id: 'issue', from: 'user', body: description, createdAt: issue.createdAt })
  }
  for (const comment of comments) {
    if (comment.author === actors.admin) {
      if (comment.body.includes(USER_MARKER)) {
        const body = stripMarker(comment.body)
        if (body) messages.push({ id: String(comment.id), from: 'user', body, createdAt: comment.createdAt })
      } else if (!comment.body.trimStart().startsWith(INTERNAL_PREFIX) && comment.body.trim()) {
        messages.push({ id: String(comment.id), from: 'admin', body: comment.body.trim(), createdAt: comment.createdAt })
      }
    } else if (actors.agents.includes(comment.author)) {
      const body = agentReply(comment.body)
      if (body) messages.push({ id: String(comment.id), from: 'agent', body, createdAt: comment.createdAt })
    }
    // Comentários de qualquer outra pessoa ficam só no GitHub.
  }
  return messages
}

export type Context = { github: Github; store: TicketStore; actors: Actors }

function text(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || value.trim() === '') throw new TicketError('invalid', `Preencha ${field}.`)
  const trimmed = value.trim()
  if (trimmed.length > max) throw new TicketError('invalid', `Use até ${max} caracteres em ${field}.`)
  return trimmed
}

async function view(github: Github, row: TicketRow, issue: GithubIssue): Promise<TicketView> {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    createdAt: row.created_at,
    issueNumber: row.issue_number,
    issueUrl: issue.url,
    situation: await situationFor(github, issue),
  }
}

async function ownTicket({ store }: Context, id: unknown): Promise<TicketRow> {
  const row = typeof id === 'string' ? await store.get(id) : null
  if (!row) throw new TicketError('not_found', 'Ticket não encontrado.')
  return row
}

/** Os tickets do usuário, do mais novo ao mais antigo, com a situação de cada um. */
export async function listTickets(ctx: Context): Promise<TicketView[]> {
  const rows = await ctx.store.list()
  return Promise.all(rows.map(async (row) => view(ctx.github, row, await ctx.github.getIssue(row.issue_number))))
}

/** Abre um ticket: cria a issue (anônima) e grava a ligação. */
export async function openTicket(
  ctx: Context,
  input: { type?: unknown; title?: unknown; description?: unknown },
): Promise<TicketView> {
  if (!TICKET_TYPES.includes(input.type as TicketType)) throw new TicketError('invalid', 'Escolha o tipo do ticket.')
  const type = input.type as TicketType
  const title = text(input.title, 'o título', TITLE_MAX)
  const description = text(input.description, 'a descrição', BODY_MAX)

  const inProgress = (await listTickets(ctx)).filter((ticket) => !isClosed(ticket.situation))
  if (inProgress.length >= OPEN_LIMIT) {
    throw new TicketError(
      'limit',
      `Você já tem ${OPEN_LIMIT} tickets em andamento. Quando algum for concluído ou recusado, você poderá abrir outro.`,
    )
  }

  const issue = await ctx.github.createIssue({
    title,
    body: `${description}\n\n${USER_MARKER}`,
    labels: [LABEL.ticket, LABEL.triage, type === 'fix' ? 'bug' : 'enhancement'],
  })
  const row = await ctx.store.insert({ issue_number: issue.number, type, title })
  return view(ctx.github, row, await ctx.github.getIssue(issue.number))
}

/** A situação e a conversa de um ticket do usuário. */
export async function readTicket(ctx: Context, input: { ticket_id?: unknown }): Promise<TicketDetail> {
  const row = await ownTicket(ctx, input.ticket_id)
  const [issue, comments] = await Promise.all([ctx.github.getIssue(row.issue_number), ctx.github.listComments(row.issue_number)])
  const ticket = await view(ctx.github, row, issue)
  return { ...ticket, closed: isClosed(ticket.situation), messages: conversation(issue, comments, ctx.actors) }
}

/** Comenta na issue. Se ela esperava informação do usuário, volta para a triagem. */
export async function replyTicket(ctx: Context, input: { ticket_id?: unknown; body?: unknown }): Promise<void> {
  const row = await ownTicket(ctx, input.ticket_id)
  const body = text(input.body, 'a mensagem', BODY_MAX)
  const issue = await ctx.github.getIssue(row.issue_number)
  if (isClosed(await situationFor(ctx.github, issue))) {
    throw new TicketError('closed', 'Este ticket está encerrado. Abra um novo ticket.')
  }
  await ctx.github.addComment(row.issue_number, `${body}\n\n${USER_MARKER}`)
  if (issue.labels.includes(LABEL.needsInfo)) {
    await ctx.github.setLabels(row.issue_number, [...issue.labels.filter((label) => label !== LABEL.needsInfo), LABEL.triage])
  }
}
