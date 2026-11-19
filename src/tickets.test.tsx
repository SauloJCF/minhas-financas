import { onlineManager } from '@tanstack/react-query'
import { act, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { db } from '@/test/fake-supabase'
import { renderAt } from '@/test/render'
import type { Situation, TicketDetail, TicketView } from '../supabase/functions/tickets/core'

vi.mock('@/lib/supabase', () => import('@/test/fake-supabase'))

const ticket = (id: string, patch: Partial<TicketView> = {}): TicketView => ({
  id,
  type: 'fix',
  title: `Ticket ${id}`,
  createdAt: '2026-11-19T10:00:00Z',
  issueNumber: Number(id.replace('t', '')) + 100,
  issueUrl: `https://github.com/o/r/issues/${Number(id.replace('t', '')) + 100}`,
  situation: 'analysis',
  ...patch,
})

type Call = Record<string, unknown>
let calls: Call[]
let tickets: TicketView[]
let messages: TicketDetail['messages']

beforeEach(() => {
  calls = []
  tickets = []
  messages = [{ id: 'issue', from: 'user', body: 'O saldo não bate.', createdAt: '2026-11-19T10:00:00Z' }]
  db.functions.tickets = (body) => {
    calls.push(body)
    switch (body.action) {
      case 'list':
        return { data: tickets }
      case 'read': {
        const found = tickets.find((item) => item.id === body.ticket_id)
        if (!found) return { error: { code: 'not_found', message: 'Ticket não encontrado.', status: 404 } }
        return { data: { ...found, messages, closed: found.situation === 'done' || found.situation === 'refused' } }
      }
      case 'open': {
        const created = ticket(`t${tickets.length + 1}`, { title: String(body.title) })
        tickets = [created, ...tickets]
        return { data: created }
      }
      case 'reply':
        messages = [...messages, { id: 'novo', from: 'user', body: String(body.body), createdAt: '2026-11-19T12:00:00Z' }]
        return { data: { ok: true } }
    }
    throw new Error(`ação inesperada: ${String(body.action)}`)
  }
})

test('o Perfil leva à tela Tickets, que mostra a situação de cada ticket', async () => {
  tickets = [ticket('t2', { situation: 'waiting_you', createdAt: '2026-11-19T12:00:00Z' }), ticket('t1')]
  const user = renderAt('/perfil')

  await user.click(await screen.findByRole('link', { name: /Tickets/ }))

  const list = await screen.findByRole('list')
  const rows = within(list).getAllByRole('listitem')
  expect(rows).toHaveLength(2)
  expect(within(rows[0]).getByText('Ticket t2')).toBeInTheDocument()
  expect(within(rows[0]).getByText('Aguardando você')).toBeInTheDocument()
  expect(within(rows[0]).getByText(/abertura: 19\/11\/2026/)).toBeInTheDocument()
  expect(within(rows[1]).getByText('Em análise')).toBeInTheDocument()
})

test('sem tickets, avisa e oferece abrir o primeiro', async () => {
  renderAt('/tickets')
  expect(await screen.findByText('Você ainda não abriu nenhum ticket.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Abrir ticket/ })).toHaveAttribute('href', '/tickets/novo')
})

test('abre um ticket, com o aviso de que será público, e vai para a conversa', async () => {
  const user = renderAt('/tickets/novo')

  expect(await screen.findByText(/será público no GitHub/)).toHaveTextContent('Não inclua valores nem dados pessoais')
  await user.click(screen.getByLabelText('Correção'))
  await user.type(screen.getByLabelText('Título'), 'Saldo errado')
  await user.type(screen.getByLabelText('Descrição'), 'O saldo não bate.')
  await user.click(screen.getByRole('button', { name: 'Enviar ticket' }))

  expect(await screen.findByRole('heading', { name: 'Saldo errado' })).toBeInTheDocument()
  expect(calls).toContainEqual({ action: 'open', type: 'fix', title: 'Saldo errado', description: 'O saldo não bate.' })
})

test('valida título e descrição antes de enviar', async () => {
  const user = renderAt('/tickets/novo')
  await user.click(await screen.findByRole('button', { name: 'Enviar ticket' }))
  expect(await screen.findByText('Informe o título.')).toBeInTheDocument()
  expect(screen.getByText('Descreva o pedido.')).toBeInTheDocument()

  await user.type(screen.getByLabelText('Título'), 'a'.repeat(101))
  await user.click(screen.getByRole('button', { name: 'Enviar ticket' }))
  expect(await screen.findByText('Use até 100 caracteres.')).toBeInTheDocument()
  expect(calls.filter((call) => call.action === 'open')).toEqual([])
})

test('com 3 tickets em andamento, não deixa abrir o quarto e explica por quê', async () => {
  tickets = [ticket('t4', { situation: 'done' }), ticket('t3'), ticket('t2', { situation: 'approved' }), ticket('t1', { situation: 'implementing' })]
  renderAt('/tickets/novo')

  expect(await screen.findByText(/Você já tem 3 tickets em andamento/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Enviar ticket' })).toBeDisabled()
})

test('mostra o erro da função quando o servidor recusa', async () => {
  db.functions.tickets = (body) =>
    body.action === 'list'
      ? { data: [] }
      : { error: { code: 'limit', message: 'Você já tem 3 tickets em andamento.', status: 409 } }
  const user = renderAt('/tickets/novo')
  await user.type(await screen.findByLabelText('Título'), 'Algo')
  await user.type(screen.getByLabelText('Descrição'), 'Detalhe')
  await user.click(screen.getByRole('button', { name: 'Enviar ticket' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Você já tem 3 tickets em andamento.')
})

test('a tela do ticket mostra a conversa, a situação e o link da issue; responder comenta e atualiza', async () => {
  tickets = [ticket('t1', { situation: 'waiting_you' })]
  messages = [
    ...messages,
    { id: '1', from: 'admin', body: 'Em qual conta?', createdAt: '2026-11-19T11:00:00Z' },
  ]
  const user = renderAt('/tickets/t1')

  const conversation = await screen.findByRole('list', { name: 'Conversa' })
  expect(within(conversation).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
    expect.stringContaining('O saldo não bate.'),
    expect.stringContaining('Em qual conta?'),
  ])
  expect(screen.getByText('Aguardando você')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Issue #101/ })).toHaveAttribute('href', 'https://github.com/o/r/issues/101')

  await user.type(screen.getByLabelText('Responder'), 'Na Nubank.')
  await user.click(screen.getByRole('button', { name: 'Enviar' }))

  await waitFor(() => expect(within(screen.getByRole('list', { name: 'Conversa' })).getAllByRole('listitem')).toHaveLength(3))
  expect(calls).toContainEqual({ action: 'reply', ticket_id: 't1', body: 'Na Nubank.' })
  expect(screen.getByLabelText('Responder')).toHaveValue('')
})

test.each([
  ['done', 'Concluído'],
  ['refused', 'Recusado'],
] as [Situation, string][])('ticket %s não tem campo de resposta e oferece abrir um novo', async (situation, label) => {
  tickets = [ticket('t1', { situation })]
  renderAt('/tickets/t1')

  expect(await screen.findByText(label)).toBeInTheDocument()
  expect(screen.queryByLabelText('Responder')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Abrir novo ticket' })).toHaveAttribute('href', '/tickets/novo')
})

test('a conversa é relida a cada 30 segundos e ao voltar para a aba', async () => {
  tickets = [ticket('t1')]
  vi.useFakeTimers({ shouldAdvanceTime: true })
  try {
    renderAt('/tickets/t1')
    await screen.findByText('O saldo não bate.')
    const reads = () => calls.filter((call) => call.action === 'read').length
    expect(reads()).toBe(1)

    messages = [...messages, { id: '2', from: 'admin', body: 'Vou olhar.', createdAt: '2026-11-19T11:00:00Z' }]
    await act(() => vi.advanceTimersByTimeAsync(30_000))
    expect(await screen.findByText('Vou olhar.')).toBeInTheDocument()
    expect(reads()).toBe(2)

    // O TanStack Query entende "voltar para a aba" como a aba ficar visível depois de oculta.
    const visibility = vi.spyOn(document, 'visibilityState', 'get')
    for (const state of ['hidden', 'visible'] as const) {
      visibility.mockReturnValue(state)
      await act(async () => void window.dispatchEvent(new Event('visibilitychange')))
    }
    visibility.mockRestore()
    await waitFor(() => expect(reads()).toBe(3))
  } finally {
    vi.useRealTimers()
  }
})

test('sem rede, mostra o que já carregou e desliga o envio', async () => {
  tickets = [ticket('t1')]
  renderAt('/tickets/t1')
  await screen.findByText('O saldo não bate.')

  act(() => onlineManager.setOnline(false))
  expect(await screen.findByText(/Sem conexão: responder precisa de internet/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled()
  expect(screen.getByText('O saldo não bate.')).toBeInTheDocument()
})

test('com ticket aguardando você, o Perfil e o item Tickets ganham a bolinha; ela some depois da resposta', async () => {
  tickets = [ticket('t1', { situation: 'waiting_you' })]
  const base = db.functions.tickets
  db.functions.tickets = (body) => {
    // Como o workflow faz: a resposta do usuário tira o ticket de "Aguardando você".
    if (body.action === 'reply') tickets = tickets.map((item) => ({ ...item, situation: 'analysis' }))
    return base(body)
  }
  const user = renderAt('/perfil')

  const nav = await screen.findByRole('navigation', { name: 'Principal' })
  expect(await within(within(nav).getByRole('link', { name: /Perfil/ })).findByText('Há tickets aguardando você')).toBeInTheDocument()
  const ticketsLink = screen.getByRole('link', { name: /Tickets/ })
  expect(within(ticketsLink).getByText('Há tickets aguardando você')).toBeInTheDocument()

  await user.click(ticketsLink)
  await user.click(await screen.findByRole('link', { name: /Ticket t1/ }))
  await user.type(await screen.findByLabelText('Responder'), 'Segue a resposta.')
  await user.click(screen.getByRole('button', { name: 'Enviar' }))

  await waitFor(() => expect(screen.queryByText('Há tickets aguardando você')).not.toBeInTheDocument())
})

test('sem ticket aguardando, não há bolinha', async () => {
  tickets = [ticket('t1')]
  renderAt('/perfil')
  await screen.findByRole('link', { name: /Tickets/ })
  await waitFor(() => expect(calls.some((call) => call.action === 'list')).toBe(true))
  expect(screen.queryByText('Há tickets aguardando você')).not.toBeInTheDocument()
})

test('se a lista falhar, não há bolinha nem erro na tela', async () => {
  db.functions.tickets = () => ({ error: { code: 'x', message: 'falhou', status: 500 } })
  renderAt('/perfil')
  await screen.findByRole('link', { name: /Tickets/ })
  expect(screen.queryByText('Há tickets aguardando você')).not.toBeInTheDocument()
  expect(screen.queryByText('falhou')).not.toBeInTheDocument()
})
