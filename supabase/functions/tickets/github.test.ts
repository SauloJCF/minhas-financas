import { expect, test, vi } from 'vitest'
import { TicketError } from './core.ts'
import { createGithub } from './github.ts'

const TOKEN = 'github_pat_SEGREDO'

function client(respond: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => respond(String(url), init ?? {}))
  return { fetch, github: createGithub({ token: TOKEN, repo: 'dono/sandbox', admin: 'saulo', fetch: fetch as typeof globalThis.fetch }) }
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

test('fala só com o repositório configurado, com o token no cabeçalho', async () => {
  const { github, fetch } = client(() => json({ number: 7 }))
  await github.createIssue({ title: 'T', body: 'B', labels: ['ticket'] })
  const [url, init] = fetch.mock.calls[0] as [string, RequestInit]
  expect(url).toBe('https://api.github.com/repos/dono/sandbox/issues')
  expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`)
  expect(JSON.parse(init.body as string)).toEqual({ title: 'T', body: 'B', labels: ['ticket'] })
})

test('lê a issue no formato do core', async () => {
  const { github } = client(() =>
    json({
      number: 3,
      html_url: 'https://github.com/dono/sandbox/issues/3',
      state: 'closed',
      state_reason: 'not_planned',
      labels: [{ name: 'wontfix' }, 'ticket'],
      body: null,
      user: { login: 'saulo' },
      created_at: '2026-11-19T10:00:00Z',
    }),
  )
  expect(await github.getIssue(3)).toEqual({
    number: 3,
    url: 'https://github.com/dono/sandbox/issues/3',
    state: 'closed',
    stateReason: 'not_planned',
    labels: ['wontfix', 'ticket'],
    body: '',
    author: 'saulo',
    createdAt: '2026-11-19T10:00:00Z',
  })
})

test('PR aberta do administrador ou do agente na timeline conta; PR fechada ou de outra pessoa, não', async () => {
  const event = (state: string, login: string, pr = true) => ({
    event: 'cross-referenced',
    source: { issue: { state, user: { login }, ...(pr ? { pull_request: {} } : {}) } },
  })
  const has = async (events: unknown[]) => {
    const github = createGithub({ token: TOKEN, repo: 'dono/sandbox', admin: 'saulo', agents: ['claude[bot]'], fetch: (async () => json(events)) as typeof globalThis.fetch })
    return github.hasOpenPullRequest(1)
  }

  expect(await has([event('open', 'saulo')])).toBe(true)
  expect(await has([event('closed', 'saulo')])).toBe(false)
  expect(await has([event('open', 'claude[bot]')])).toBe(true)
  expect(await has([event('open', 'intruso')])).toBe(false)
  expect(await has([event('open', 'saulo', false)])).toBe(false)
  expect(await has([{ event: 'labeled' }])).toBe(false)
})

test('o erro do GitHub não vaza o token nem a resposta', async () => {
  const { github } = client(() => json({ message: `Bad credentials ${TOKEN}` }, 401))
  const error = await github.addComment(1, 'oi').catch((reason: unknown) => reason)
  expect(error).toBeInstanceOf(TicketError)
  expect((error as TicketError).code).toBe('github')
  expect(JSON.stringify(error) + (error as Error).message).not.toContain(TOKEN)
  expect((error as Error).message).not.toContain('Bad credentials')
})

test('falha de rede também vira erro sem detalhes', async () => {
  const { github } = client(() => {
    throw new Error(`falhou com ${TOKEN}`)
  })
  const error = await github.getIssue(1).catch((reason: unknown) => reason)
  expect((error as TicketError).code).toBe('github')
  expect((error as Error).message).not.toContain(TOKEN)
})
