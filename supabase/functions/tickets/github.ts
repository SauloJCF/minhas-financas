// Cliente do GitHub usado pela Edge Function. Sem nada de Deno (só `fetch`), para o tipo
// `Github` ser o único ponto de contato com o resto. Nenhum erro daqui carrega a resposta do
// GitHub nem o token: só uma mensagem fixa.
import { TicketError, type Github, type GithubComment, type GithubIssue } from './core.ts'

type Fetch = typeof fetch

type RawIssue = {
  number: number
  html_url: string
  state: 'open' | 'closed'
  state_reason?: string | null
  labels: (string | { name?: string })[]
  body?: string | null
  user?: { login?: string } | null
  created_at: string
}

type RawEvent = {
  event?: string
  source?: { issue?: { state?: string; pull_request?: unknown; user?: { login?: string } | null } }
}

function toIssue(raw: RawIssue): GithubIssue {
  return {
    number: raw.number,
    url: raw.html_url,
    state: raw.state,
    stateReason: raw.state_reason ?? null,
    labels: raw.labels.map((label) => (typeof label === 'string' ? label : (label.name ?? ''))).filter(Boolean),
    body: raw.body ?? '',
    author: raw.user?.login ?? '',
    createdAt: raw.created_at,
  }
}

/**
 * `repo` é "dono/nome". Só PRs do administrador ou do agente (`agents`) contam como "em
 * implementação": a PR de um terceiro que cita a issue não muda a situação do ticket.
 */
export function createGithub(options: { token: string; repo: string; admin: string; agents?: string[]; fetch?: Fetch }): Github {
  const { token, repo, admin } = options
  const prAuthors = [admin, ...(options.agents ?? [])]
  const send = options.fetch ?? fetch

  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    let response: Response
    try {
      response = await send(`https://api.github.com/repos/${repo}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'minhas-financas-tickets',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch {
      throw new TicketError('github', 'Não foi possível falar com o GitHub. Tente de novo em instantes.')
    }
    if (response.status === 404 && method === 'GET') {
      throw new TicketError('not_found', 'A issue deste ticket não foi encontrada no GitHub.')
    }
    if (!response.ok) throw new TicketError('github', 'O GitHub recusou o pedido. Tente de novo em instantes.')
    return (response.status === 204 ? undefined : await response.json()) as T
  }

  return {
    async createIssue(input) {
      const raw = await call<RawIssue>('POST', '/issues', input)
      return { number: raw.number }
    },
    async getIssue(number) {
      return toIssue(await call<RawIssue>('GET', `/issues/${number}`))
    },
    async listComments(number) {
      const comments: GithubComment[] = []
      // Uma conversa de ticket não passa de algumas páginas; o teto evita um laço sem fim.
      for (let page = 1; page <= 5; page++) {
        const raw = await call<
          { id: number; body?: string | null; user?: { login?: string } | null; created_at: string }[]
        >('GET', `/issues/${number}/comments?per_page=100&page=${page}`)
        comments.push(
          ...raw.map((item) => ({
            id: item.id,
            author: item.user?.login ?? '',
            body: item.body ?? '',
            createdAt: item.created_at,
          })),
        )
        if (raw.length < 100) break
      }
      return comments
    },
    async addComment(number, body) {
      await call('POST', `/issues/${number}/comments`, { body })
    },
    async setLabels(number, labels) {
      await call('PUT', `/issues/${number}/labels`, { labels })
    },
    async hasOpenPullRequest(number) {
      // A PR que diz "Closes #n" aparece na timeline da issue como referência cruzada.
      const events = await call<RawEvent[]>('GET', `/issues/${number}/timeline?per_page=100`)
      return events.some(
        (event) =>
          event.event === 'cross-referenced' &&
          event.source?.issue?.pull_request !== undefined &&
          event.source.issue.state === 'open' &&
          prAuthors.includes(event.source.issue.user?.login ?? ''),
      )
    },
  }
}
