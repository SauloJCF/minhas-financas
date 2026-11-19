import { ChevronRight, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { ErrorMessage, FormPage, LoadingMessage } from '@/components/FormPage'
import { Button } from '@/components/ui/button'
import { TYPE_LABEL, useTickets } from '@/tickets/api'
import { SituationBadge } from '@/tickets/SituationBadge'

export function Tickets() {
  const { data: tickets, isPending, isError } = useTickets()

  return (
    <FormPage title="Tickets" back={{ to: '/perfil', label: 'Perfil' }}>
      <p className="text-sm text-muted-foreground">
        Peça uma melhoria ou relate um problema do app e acompanhe a conversa por aqui.
      </p>
      <Button asChild>
        <Link to="/tickets/novo">
          <Plus aria-hidden />
          Abrir ticket
        </Link>
      </Button>

      {isPending && <LoadingMessage />}
      {isError && <ErrorMessage>Não foi possível carregar os tickets. Verifique sua conexão.</ErrorMessage>}
      {tickets?.length === 0 && <p className="text-sm text-muted-foreground">Você ainda não abriu nenhum ticket.</p>}
      {tickets && tickets.length > 0 && (
        <ul className="grid gap-1">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <Link to={`/tickets/${ticket.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted">
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="truncate font-medium">{ticket.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {TYPE_LABEL[ticket.type]} · abertura: {new Date(ticket.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                </span>
                <SituationBadge situation={ticket.situation} />
                <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </FormPage>
  )
}
