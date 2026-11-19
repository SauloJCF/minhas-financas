import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { z } from 'zod'
import { FormField } from '@/components/FormField'
import { ErrorMessage, FormPage } from '@/components/FormPage'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useOnline } from '@/lib/offline'
import {
  BODY_MAX,
  isClosed,
  OPEN_LIMIT,
  TITLE_MAX,
  TYPE_LABEL,
  ticketsErrorMessage,
  useOpenTicket,
  useTickets,
} from '@/tickets/api'

const schema = z.object({
  type: z.enum(['improvement', 'fix']),
  title: z.string().trim().min(1, 'Informe o título.').max(TITLE_MAX, `Use até ${TITLE_MAX} caracteres.`),
  description: z.string().trim().min(1, 'Descreva o pedido.').max(BODY_MAX, `Use até ${BODY_MAX} caracteres.`),
})
type Values = z.infer<typeof schema>

export function TicketNew() {
  const navigate = useNavigate()
  const online = useOnline()
  const open = useOpenTicket()
  const { data: tickets } = useTickets()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'improvement', title: '', description: '' },
  })

  const atLimit = (tickets?.filter((ticket) => !isClosed(ticket.situation)).length ?? 0) >= OPEN_LIMIT

  const submit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      const ticket = await open.mutateAsync(values)
      void navigate(`/tickets/${ticket.id}`, { replace: true })
    } catch (error) {
      setFormError(ticketsErrorMessage(error))
    }
  })

  return (
    <FormPage title="Abrir ticket" back={{ to: '/tickets', label: 'Tickets' }}>
      <form onSubmit={submit} noValidate className="grid gap-4">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Tipo</legend>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            {(['improvement', 'fix'] as const).map((type) => (
              <label key={type} className="cursor-pointer">
                <input type="radio" value={type} className="peer sr-only" {...register('type')} />
                <span className="block rounded-md py-1.5 text-center text-sm text-muted-foreground peer-checked:bg-background peer-checked:font-medium peer-checked:text-foreground peer-checked:shadow-sm peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50">
                  {TYPE_LABEL[type]}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <FormField label="Título" error={errors.title?.message} {...register('title')} />

        <div className="grid gap-2">
          <Label htmlFor="ticket-description">Descrição</Label>
          <textarea
            id="ticket-description"
            rows={6}
            aria-invalid={errors.description ? true : undefined}
            className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30"
            {...register('description')}
          />
          {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
        </div>

        {atLimit && (
          <ErrorMessage>
            Você já tem {OPEN_LIMIT} tickets em andamento. Quando algum for concluído ou recusado, você poderá abrir
            outro.
          </ErrorMessage>
        )}
        {formError && <ErrorMessage>{formError}</ErrorMessage>}
        <p className="text-sm text-muted-foreground">
          O ticket será público no GitHub. Não inclua valores nem dados pessoais.
        </p>
        <Button type="submit" disabled={isSubmitting || !online || atLimit}>
          {isSubmitting ? 'Enviando…' : 'Enviar ticket'}
        </Button>
        {!online && <p className="text-xs text-muted-foreground">Sem conexão: abrir um ticket precisa de internet.</p>}
      </form>
    </FormPage>
  )
}
