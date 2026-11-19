// Edge Function `tickets` (ADR 0011): a ponte entre o app e as issues do GitHub. Roda em Deno,
// no Supabase. Toda a regra está em core.ts; aqui só entram a autenticação, o banco e o GitHub.
import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  listTickets,
  openTicket,
  readTicket,
  replyTicket,
  TicketError,
  type Context,
  type TicketRow,
  type TicketStore,
} from './core.ts'
import { createGithub } from './github.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function respond(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

/** O token e o repositório vêm dos secrets. Sem os dois, a integração está desligada (caso do ambiente local). */
function githubFromEnv() {
  const token = Deno.env.get('GH_TICKETS_TOKEN')
  const repo = Deno.env.get('GH_TICKETS_REPO')
  if (!token || !repo) {
    throw new TicketError('not_configured', 'A integração com o GitHub não está configurada.')
  }
  // O administrador é o dono do repositório, a menos que os secrets digam outro.
  const admin = Deno.env.get('GH_TICKETS_ADMIN') ?? repo.split('/')[0]
  const agents = (Deno.env.get('GH_TICKETS_AGENTS') ?? 'claude[bot],github-actions[bot]')
    .split(',')
    .map((login) => login.trim())
    .filter(Boolean)
  return { github: createGithub({ token, repo, admin }), actors: { admin, agents } }
}

const COLUMNS = 'id, issue_number, type, title, created_at'

function storeFor(client: ReturnType<typeof createClient>): TicketStore {
  return {
    async list() {
      const { data, error } = await client.from('tickets').select(COLUMNS).order('created_at', { ascending: false })
      if (error) throw new Error('falha ao ler tickets')
      return data as TicketRow[]
    },
    async get(id) {
      const { data, error } = await client.from('tickets').select(COLUMNS).eq('id', id).maybeSingle()
      if (error) throw new Error('falha ao ler ticket')
      return data as TicketRow | null
    },
    async insert(row) {
      const { data, error } = await client.from('tickets').insert(row).select(COLUMNS).single()
      if (error) throw new Error('falha ao gravar ticket')
      return data as TicketRow
    },
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (request.method !== 'POST') return respond(405, { error: { code: 'invalid', message: 'Método não permitido.' } })

  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization) return respond(401, { error: { code: 'unauthorized', message: 'Entre na sua conta.' } })

    // O cliente carrega o JWT do usuário: a RLS de `tickets` vale em tudo o que a função lê e grava.
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authorization } },
    })
    const { data: auth } = await client.auth.getUser()
    if (!auth.user) return respond(401, { error: { code: 'unauthorized', message: 'Entre na sua conta.' } })

    const input = (await request.json().catch(() => null)) as { action?: string } & Record<string, unknown>
    const ctx: Context = { ...githubFromEnv(), store: storeFor(client) }

    switch (input?.action) {
      case 'list':
        return respond(200, await listTickets(ctx))
      case 'open':
        return respond(200, await openTicket(ctx, input))
      case 'read':
        return respond(200, await readTicket(ctx, input))
      case 'reply':
        await replyTicket(ctx, input)
        return respond(200, { ok: true })
      default:
        return respond(400, { error: { code: 'invalid', message: 'Ação desconhecida.' } })
    }
  } catch (error) {
    if (error instanceof TicketError) return respond(error.status, { error: { code: error.code, message: error.message } })
    // Só o nome do erro vai para o log: nada que possa carregar o token ou texto do usuário.
    console.error('erro inesperado na função tickets:', error instanceof Error ? error.name : 'desconhecido')
    return respond(500, { error: { code: 'internal', message: 'Erro inesperado. Tente de novo.' } })
  }
})
