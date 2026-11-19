import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUserQueryKey } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import type { Situation, TicketDetail, TicketType, TicketView } from '../../supabase/functions/tickets/core'

export type { Message, Situation, TicketDetail, TicketType, TicketView } from '../../supabase/functions/tickets/core'
export { BODY_MAX, isClosed, OPEN_LIMIT, TITLE_MAX } from '../../supabase/functions/tickets/core'

export const TYPE_LABEL: Record<TicketType, string> = { improvement: 'Melhoria', fix: 'Correção' }

export const SITUATION_LABEL: Record<Situation, string> = {
  analysis: 'Em análise',
  waiting_you: 'Aguardando você',
  approved: 'Aprovado',
  implementing: 'Em implementação',
  done: 'Concluído',
  refused: 'Recusado',
}

/** Erro de uma chamada à função, já com texto para mostrar ao usuário. */
export class TicketsError extends Error {}

const GENERIC = 'Não foi possível concluir. Verifique sua conexão e tente de novo.'

/** Chama a Edge Function `tickets`. */
async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('tickets', { body })
  if (error) {
    // Erro HTTP da função: o corpo traz a mensagem pensada para o usuário.
    const context = (error as { context?: unknown }).context
    if (context instanceof Response) {
      const payload = (await context.json().catch(() => null)) as { error?: { message?: string } } | null
      if (payload?.error?.message) throw new TicketsError(payload.error.message)
    }
    throw new TicketsError(GENERIC)
  }
  return data as T
}

/** Mensagem de um erro das chamadas daqui. */
export function ticketsErrorMessage(error: unknown): string {
  return error instanceof TicketsError ? error.message : GENERIC
}

/** Os tickets do usuário, com a situação de cada um. */
export function useTickets() {
  return useQuery({
    queryKey: useUserQueryKey('tickets'),
    queryFn: () => call<TicketView[]>({ action: 'list' }),
  })
}

/**
 * Há ticket aguardando resposta do usuário? Lê a mesma consulta de `useTickets`, sem repetir a
 * chamada. Se ela falhar (offline, sem GitHub), é `false`: o indicador só não aparece.
 */
export function useHasWaitingTickets(): boolean {
  const { data } = useQuery({
    queryKey: useUserQueryKey('tickets'),
    queryFn: () => call<TicketView[]>({ action: 'list' }),
    staleTime: 60_000,
    select: (tickets) => tickets.some((ticket) => ticket.situation === 'waiting_you'),
  })
  return data ?? false
}

/** A conversa de um ticket. Relida a cada 30 s com a aba visível, e ao voltar para ela. */
export function useTicket(id: string | undefined) {
  return useQuery({
    queryKey: useUserQueryKey('ticket', id),
    queryFn: () => call<TicketDetail>({ action: 'read', ticket_id: id }),
    enabled: Boolean(id),
    refetchInterval: 30_000,
    refetchOnWindowFocus: 'always',
  })
}

export type NewTicket = { type: TicketType; title: string; description: string }

/** Abre um ticket; devolve o ticket criado, para ir direto à conversa. */
export function useOpenTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ticket: NewTicket) => call<TicketView>({ action: 'open', ...ticket }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets'] }),
  })
}

export function useReplyTicket(ticketId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: string) => call<{ ok: true }>({ action: 'reply', ticket_id: ticketId, body }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ticket'] }),
        queryClient.invalidateQueries({ queryKey: ['tickets'] }),
      ]),
  })
}
