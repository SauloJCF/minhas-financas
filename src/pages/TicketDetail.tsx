import { zodResolver } from '@hookform/resolvers/zod'
import { cn } from 'cn'
import { ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useParams } from 'react-router'
import { z } from 'zod'
import { ErrorMessage, FormPage, LoadingMessage } from '@/components/FormPage'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useOnline } from '@/lib/offline'
import { BODY_MAX, TYPE_LABEL, ticketsErrorMessage, useReplyTicket, useTicket, type Message } from '@/tickets/api'
import { SituationBadge } from '@/tickets/SituationBadge'

const AUTHOR: Record<Message['from'], string> = { user: 'Você', admin: 'Administrador', agent: 'Assistente' }

function MessageBubble({ message }: { message: Message }) {
  const mine = message.from === 'user'
  const when = new Date(message.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  return (
    <li
      className={cn(
        'grid max-w-[85%] gap-1 rounded-2xl px-3 py-2',
        mine ? 'justify-self-end bg-primary/10' : 'justify-self-start bg-muted',
      )}
    >
      <span className="text-xs text-muted-foreground">
        {AUTHOR[message.from]} · {when}
      </span>
      <span className="text-sm break-words whitespace-pre-wrap">{message.body}</span>
    </li>
  )
}

const replySchema = z.object({
  body: z.string().trim().min(1, 'Escreva a mensagem.').max(BODY_MAX, `Use até ${BODY_MAX} caracteres.`),
})

function ReplyForm({ ticketId }: { ticketId: string }) {
  const online = useOnline()
  const reply = useReplyTicket(ticketId)
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof replySchema>>({ resolver: zodResolver(replySchema), defaultValues: { body: '' } })

  const submit = handleSubmit(async ({ body }) => {
    setFormError(null)
    try {
      await reply.mutateAsync(body)
      reset()
    } catch (error) {
      setFormError(ticketsErrorMessage(error))
    }
  })

  return (
    <form onSubmit={submit} noValidate className="grid gap-2">
      <Label htmlFor="ticket-reply">Responder</Label>
      <textarea
        id="ticket-reply"
        rows={4}
        aria-invalid={errors.body ? true : undefined}
        className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30"
        {...register('body')}
      />
      {errors.body && <p className="text-sm text-destructive">{errors.body.message}</p>}
      {formError && <ErrorMessage>{formError}</ErrorMessage>}
      <Button type="submit" disabled={isSubmitting || !online}>
        {isSubmitting ? 'Enviando…' : 'Enviar'}
      </Button>
      {!online && <p className="text-xs text-muted-foreground">Sem conexão: responder precisa de internet.</p>}
    </form>
  )
}

export function TicketDetail() {
  const { id } = useParams()
  const { data: ticket, isPending, isError } = useTicket(id)

  return (
    <FormPage title={ticket?.title ?? 'Ticket'} back={{ to: '/tickets', label: 'Tickets' }}>
      {isPending && <LoadingMessage />}
      {isError && !ticket && <ErrorMessage>Não foi possível carregar o ticket. Verifique sua conexão.</ErrorMessage>}
      {ticket && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{TYPE_LABEL[ticket.type]}</span>
            <SituationBadge situation={ticket.situation} />
            <a
              href={ticket.issueUrl}
              target="_blank"
              rel="noreferrer"
              className="ml-auto flex items-center gap-1 hover:text-foreground"
            >
              Issue #{ticket.issueNumber}
              <ExternalLink aria-hidden className="size-3.5" />
            </a>
          </div>

          <ul aria-label="Conversa" className="grid gap-2">
            {ticket.messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </ul>

          {ticket.closed ? (
            <div className="grid gap-3 rounded-xl border p-3 text-sm">
              <p>Este ticket está encerrado. Para continuar a conversa, abra um novo ticket.</p>
              <Button asChild variant="outline">
                <Link to="/tickets/novo">Abrir novo ticket</Link>
              </Button>
            </div>
          ) : (
            <ReplyForm ticketId={ticket.id} />
          )}
        </>
      )}
    </FormPage>
  )
}
