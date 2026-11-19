import { beforeEach, describe, expect, test } from 'vitest'
import {
  conversation,
  INTERNAL_PREFIX,
  listTickets,
  openTicket,
  readTicket,
  replyTicket,
  REPLY_END,
  REPLY_START,
  situationOf,
  TicketError,
  USER_MARKER,
  type Actors,
  type Context,
  type Github,
  type GithubComment,
  type GithubIssue,
  type TicketRow,
} from './core.ts'

const actors: Actors = { admin: 'saulo', agents: ['claude[bot]'] }

function issue(patch: Partial<GithubIssue> = {}): GithubIssue {
  return {
    number: 1,
    url: 'https://github.com/o/r/issues/1',
    state: 'open',
    stateReason: null,
    labels: ['ticket', 'needs-triage'],
    body: `Descrição\n\n${USER_MARKER}`,
    author: 'saulo',
    createdAt: '2026-11-19T10:00:00Z',
    ...patch,
  }
}

function comment(id: number, author: string, body: string): GithubComment {
  return { id, author, body, createdAt: `2026-11-19T10:0${id}:00Z` }
}

/** GitHub falso em memória: guarda issues e comentários e registra o que a função fez. */
function fakeGithub() {
  const issues = new Map<number, GithubIssue>()
  const comments = new Map<number, GithubComment[]>()
  const openPullRequests = new Set<number>()
  const calls: string[] = []
  let next = 100
  const github: Github = {
    async createIssue(input) {
      const number = next++
      issues.set(number, issue({ number, body: input.body, labels: input.labels, url: `https://github.com/o/r/issues/${number}` }))
      calls.push(`createIssue:${number}`)
      return { number }
    },
    async getIssue(number) {
      const found = issues.get(number)
      if (!found) throw new Error(`issue ${number} inexistente`)
      return structuredClone(found)
    },
    async listComments(number) {
      return structuredClone(comments.get(number) ?? [])
    },
    async addComment(number, body) {
      comments.set(number, [...(comments.get(number) ?? []), comment((comments.get(number)?.length ?? 0) + 1, 'saulo', body)])
      calls.push(`addComment:${number}`)
    },
    async setLabels(number, labels) {
      issues.get(number)!.labels = labels
      calls.push(`setLabels:${number}`)
    },
    async hasOpenPullRequest(number) {
      return openPullRequests.has(number)
    },
  }
  return { github, issues, comments, openPullRequests, calls }
}

/** Tickets em memória de um usuário só: o que a RLS já isolaria no banco. */
function fakeStore(initial: TicketRow[] = []) {
  const rows = [...initial]
  return {
    rows,
    store: {
      async list() {
        return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))
      },
      async get(id: string) {
        return rows.find((row) => row.id === id) ?? null
      },
      async insert(row: Pick<TicketRow, 'issue_number' | 'type' | 'title'>) {
        const created = { id: `t${rows.length + 1}`, created_at: `2026-11-19T11:0${rows.length}:00Z`, ...row }
        rows.push(created)
        return created
      },
    },
  }
}

describe('situationOf', () => {
  const at = (labels: string[], patch: Partial<GithubIssue> = {}, pr = false) =>
    situationOf(issue({ labels, ...patch }), pr)

  test('em análise com needs-triage ou sem nenhum label de situação', () => {
    expect(at(['ticket', 'needs-triage'])).toBe('analysis')
    expect(at(['ticket', 'enhancement'])).toBe('analysis')
  })
  test('aguardando você com needs-info', () => expect(at(['needs-info'])).toBe('waiting_you'))
  test('aprovado com ready-for-agent ou ready-for-human, sem PR', () => {
    expect(at(['ready-for-agent'])).toBe('approved')
    expect(at(['ready-for-human'])).toBe('approved')
  })
  test('em implementação com PR aberta', () => expect(at(['ready-for-agent'], {}, true)).toBe('implementing'))
  test('concluído quando fechada como resolvida', () => {
    expect(at([], { state: 'closed', stateReason: 'completed' })).toBe('done')
  })
  test('recusado com wontfix ou fechada como não planejada', () => {
    expect(at(['wontfix'])).toBe('refused')
    expect(at([], { state: 'closed', stateReason: 'not_planned' })).toBe('refused')
  })
})

describe('conversation', () => {
  test('o corpo da issue e os comentários do app são do usuário, sem o marcador', () => {
    const messages = conversation(issue(), [comment(1, 'saulo', `Mais um detalhe\n\n${USER_MARKER}`)], actors)
    expect(messages.map((m) => [m.from, m.body])).toEqual([
      ['user', 'Descrição'],
      ['user', 'Mais um detalhe'],
    ])
  })

  test('comentário do administrador no GitHub aparece, menos o que começa com [interno]', () => {
    const messages = conversation(
      issue(),
      [comment(1, 'saulo', 'Vou olhar isso'), comment(2, 'saulo', `${INTERNAL_PREFIX} nota só minha`)],
      actors,
    )
    expect(messages.filter((m) => m.from === 'admin').map((m) => m.body)).toEqual(['Vou olhar isso'])
  })

  test('do agente, só o trecho entre os marcadores', () => {
    const body = `Análise técnica longa\n${REPLY_START}\nPode detalhar o erro?\n${REPLY_END}\nLabel sugerido: needs-info`
    const messages = conversation(issue(), [comment(1, 'claude[bot]', body), comment(2, 'claude[bot]', 'sem marcadores')], actors)
    expect(messages.filter((m) => m.from === 'agent').map((m) => m.body)).toEqual(['Pode detalhar o erro?'])
  })

  test('comentário de triagem (github-actions[bot]): só a resposta ao usuário aparece, sem análise nem marcador interno', () => {
    const triage = [
      '<!-- triagem-ia -->',
      REPLY_START,
      'Entendi: você quer ver o saldo por conta. Vamos avaliar.',
      REPLY_END,
      '',
      '## Análise técnica',
      'Arquivos: src/accounts/api.ts. Sem migration. Label sugerido: `ready-for-agent`.',
    ].join('\n')
    const withBot: Actors = { admin: 'saulo', agents: ['claude[bot]', 'github-actions[bot]'] }
    const messages = conversation(issue(), [comment(1, 'github-actions[bot]', triage)], withBot)
    expect(messages.filter((m) => m.from === 'agent').map((m) => m.body)).toEqual([
      'Entendi: você quer ver o saldo por conta. Vamos avaliar.',
    ])
  })

  test('aviso de limite de triagens (workflow, sem agente): a resposta ao usuário aparece', () => {
    const notice = [
      '<!-- limite-triagem -->',
      REPLY_START,
      'Recebi sua mensagem. O administrador vai avaliar a conversa e responder por aqui.',
      REPLY_END,
    ].join('\n')
    const withBot: Actors = { admin: 'saulo', agents: ['github-actions[bot]'] }
    const messages = conversation(issue(), [comment(1, 'github-actions[bot]', notice)], withBot)
    expect(messages.filter((m) => m.from === 'agent').map((m) => m.body)).toEqual([
      'Recebi sua mensagem. O administrador vai avaliar a conversa e responder por aqui.',
    ])
  })

  test('comentário de outra pessoa fica de fora, mesmo imitando os marcadores', () => {
    const forged = [
      comment(1, 'intruso', 'Oi, eu também quero isso'),
      comment(2, 'intruso', `Falso\n\n${USER_MARKER}`),
      comment(3, 'intruso', `${REPLY_START}Falso${REPLY_END}`),
    ]
    expect(conversation(issue(), forged, actors).map((m) => m.from)).toEqual(['user'])
  })

  test('issue aberta por outra conta não vira mensagem do usuário', () => {
    expect(conversation(issue({ author: 'intruso' }), [], actors)).toEqual([])
  })

  test('mantém a ordem dos comentários', () => {
    const messages = conversation(issue(), [comment(1, 'saulo', 'a'), comment(2, 'saulo', 'b')], actors)
    expect(messages.map((m) => m.body)).toEqual(['Descrição', 'a', 'b'])
  })
})

describe('tickets', () => {
  let gh: ReturnType<typeof fakeGithub>
  let ctx: Context
  let rows: TicketRow[]

  function setup(initial: TicketRow[] = []) {
    gh = fakeGithub()
    const fake = fakeStore(initial)
    rows = fake.rows
    ctx = { github: gh.github, store: fake.store, actors }
  }
  beforeEach(() => setup())

  const row = (n: number): TicketRow => ({
    id: `t${n}`,
    issue_number: n,
    type: 'fix',
    title: `Ticket ${n}`,
    created_at: `2026-11-1${n}T10:00:00Z`,
  })
  const seed = (n: number, patch: Partial<GithubIssue> = {}) => {
    gh.issues.set(n, issue({ number: n, url: `https://github.com/o/r/issues/${n}`, ...patch }))
  }
  const expectError = async (promise: Promise<unknown>, code: string) => {
    const error = await promise.then(
      () => null,
      (reason: unknown) => reason,
    )
    expect(error).toBeInstanceOf(TicketError)
    expect((error as TicketError).code).toBe(code)
  }

  describe('abrir', () => {
    test('cria a issue anônima com os labels do tipo e grava a ligação', async () => {
      const ticket = await openTicket(ctx, { type: 'fix', title: '  Saldo errado ', description: 'O saldo não bate.' })

      const created = gh.issues.get(100)!
      expect(created.labels).toEqual(['ticket', 'needs-triage', 'bug'])
      expect(created.body).toBe(`O saldo não bate.\n\n${USER_MARKER}`)
      expect(rows).toEqual([expect.objectContaining({ issue_number: 100, type: 'fix', title: 'Saldo errado' })])
      expect(ticket).toMatchObject({ title: 'Saldo errado', situation: 'analysis', issueUrl: 'https://github.com/o/r/issues/100' })
    })

    test('melhoria leva o label enhancement', async () => {
      await openTicket(ctx, { type: 'improvement', title: 'Mais gráficos', description: 'Quero gráficos.' })
      expect(gh.issues.get(100)!.labels).toEqual(['ticket', 'needs-triage', 'enhancement'])
    })

    test.each([
      [{ type: 'duvida', title: 'T', description: 'D' }],
      [{ type: 'fix', title: '   ', description: 'D' }],
      [{ type: 'fix', title: 'a'.repeat(101), description: 'D' }],
      [{ type: 'fix', title: 'T', description: '' }],
      [{ type: 'fix', title: 'T', description: 'a'.repeat(5001) }],
    ])('recusa dados inválidos: %j', async (input) => {
      await expectError(openTicket(ctx, input), 'invalid')
      expect(gh.calls).toEqual([])
    })

    test('aceita os limites exatos de título e descrição', async () => {
      await openTicket(ctx, { type: 'fix', title: 'a'.repeat(100), description: 'b'.repeat(5000) })
      expect(rows).toHaveLength(1)
    })

    test('recusa o quarto ticket em andamento', async () => {
      setup([row(1), row(2), row(3)])
      for (const n of [1, 2, 3]) seed(n)
      await expectError(openTicket(ctx, { type: 'fix', title: 'T', description: 'D' }), 'limit')
      expect(gh.calls).toEqual([])
    })

    test('ticket encerrado não conta para o limite', async () => {
      setup([row(1), row(2), row(3)])
      seed(1)
      seed(2, { state: 'closed', stateReason: 'completed' })
      seed(3, { labels: ['wontfix'] })
      await openTicket(ctx, { type: 'fix', title: 'T', description: 'D' })
      expect(rows).toHaveLength(4)
    })
  })

  describe('listar', () => {
    test('devolve os tickets com a situação de cada um', async () => {
      setup([row(1), row(2)])
      seed(1, { labels: ['needs-info'] })
      seed(2, { state: 'closed', stateReason: 'completed' })
      const list = await listTickets(ctx)
      expect(list.map((t) => [t.id, t.situation])).toEqual([
        ['t2', 'done'],
        ['t1', 'waiting_you'],
      ])
    })

    test('só consulta PR de issue aberta e não recusada', async () => {
      setup([row(1)])
      seed(1, { labels: ['ready-for-agent'] })
      gh.openPullRequests.add(1)
      expect((await listTickets(ctx))[0].situation).toBe('implementing')
    })
  })

  describe('ler', () => {
    test('devolve situação, conversa e se está encerrado', async () => {
      setup([row(1)])
      seed(1, { labels: ['needs-info'] })
      gh.comments.set(1, [comment(1, 'saulo', 'Qual a conta?'), comment(2, 'intruso', 'spam')])
      const detail = await readTicket(ctx, { ticket_id: 't1' })
      expect(detail.situation).toBe('waiting_you')
      expect(detail.closed).toBe(false)
      expect(detail.messages.map((m) => [m.from, m.body])).toEqual([
        ['user', 'Descrição'],
        ['admin', 'Qual a conta?'],
      ])
    })

    test('ticket encerrado vem marcado', async () => {
      setup([row(1)])
      seed(1, { state: 'closed', stateReason: 'not_planned' })
      expect(await readTicket(ctx, { ticket_id: 't1' })).toMatchObject({ situation: 'refused', closed: true })
    })

    test('ticket que não é do usuário não existe', async () => {
      setup([row(1)])
      seed(1)
      await expectError(readTicket(ctx, { ticket_id: 'de-outro' }), 'not_found')
      await expectError(readTicket(ctx, {}), 'not_found')
    })
  })

  describe('responder', () => {
    test('comenta na issue com o marcador do usuário', async () => {
      setup([row(1)])
      seed(1)
      await replyTicket(ctx, { ticket_id: 't1', body: '  Foi na conta Nubank ' })
      expect(gh.comments.get(1)![0].body).toBe(`Foi na conta Nubank\n\n${USER_MARKER}`)
      expect(gh.calls).not.toContain('setLabels:1')
    })

    test('com needs-info, troca o label por needs-triage e mantém os outros', async () => {
      setup([row(1)])
      seed(1, { labels: ['ticket', 'needs-info', 'bug'] })
      await replyTicket(ctx, { ticket_id: 't1', body: 'Segue a informação' })
      expect(gh.issues.get(1)!.labels).toEqual(['ticket', 'bug', 'needs-triage'])
    })

    test.each([
      ['fechada como resolvida', { state: 'closed', stateReason: 'completed' } as const],
      ['fechada como não planejada', { state: 'closed', stateReason: 'not_planned' } as const],
      ['com wontfix', { labels: ['wontfix'] }],
    ])('recusa responder ticket encerrado (%s)', async (_name, patch) => {
      setup([row(1)])
      seed(1, patch)
      await expectError(replyTicket(ctx, { ticket_id: 't1', body: 'Oi' }), 'closed')
      expect(gh.calls).toEqual([])
    })

    test('recusa mensagem vazia ou longa demais', async () => {
      setup([row(1)])
      seed(1)
      await expectError(replyTicket(ctx, { ticket_id: 't1', body: ' ' }), 'invalid')
      await expectError(replyTicket(ctx, { ticket_id: 't1', body: 'a'.repeat(5001) }), 'invalid')
    })

    test('não responde ticket de outro usuário', async () => {
      setup([row(1)])
      seed(1)
      await expectError(replyTicket(ctx, { ticket_id: 'de-outro', body: 'Oi' }), 'not_found')
      expect(gh.calls).toEqual([])
    })
  })
})
