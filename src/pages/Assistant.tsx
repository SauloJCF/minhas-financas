import { Send } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useAccounts, type Account } from '@/accounts/api'
import { useAssistantSettings } from '@/assistant/settings'
import { useAssistantChat, type Proposal } from '@/assistant/useAssistantChat'
import { useCategories, type Category } from '@/categories/api'
import { ErrorMessage, FormPage, LoadingMessage } from '@/components/FormPage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDate } from '@/lib/dates'
import { formatBRL } from '@/lib/money'

const back = { to: '/lancamentos', label: 'Lançamentos' }

type CardProps = {
  proposal: Proposal
  accountName: string
  categoryName: string
  onConfirm: () => void
  onDiscard: () => void
}

/** O lançamento que o modelo propôs: só vira lançamento se o usuário confirmar. */
function ProposalCard({ proposal, accountName, categoryName, onConfirm, onDiscard }: CardProps) {
  const { values, status } = proposal
  const rows = [
    ['Valor', formatBRL(values.amount)],
    ['Conta', accountName],
    ['Categoria', categoryName],
    ['Vencimento', formatDate(values.due_date)],
    ['Estado', values.paid_at ? `Pago em ${formatDate(values.paid_at)}` : 'Pendente'],
    ...(values.notes ? [['Observação', values.notes]] : []),
  ]
  return (
    <li>
      <article aria-label={`Proposta: ${values.description}`} className="grid gap-3 rounded-lg border p-3">
        <div>
          <p className="text-xs text-muted-foreground">{values.type === 'income' ? 'Receita' : 'Despesa'}</p>
          <h2 className="font-medium">{values.description}</h2>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {proposal.error && <ErrorMessage>{proposal.error}</ErrorMessage>}
        {status === 'created' && (
          <p role="status" className="text-sm text-primary">
            Lançamento criado.
          </p>
        )}
        {status === 'discarded' && <p className="text-sm text-muted-foreground">Descartado.</p>}
        {(status === 'pending' || status === 'saving') && (
          <div className="flex gap-2">
            <Button className="flex-1" disabled={status === 'saving'} onClick={onConfirm}>
              {status === 'saving' ? 'Salvando…' : 'Confirmar'}
            </Button>
            <Button variant="outline" className="flex-1" disabled={status === 'saving'} onClick={onDiscard}>
              Descartar
            </Button>
          </div>
        )}
      </article>
    </li>
  )
}

type ChatProps = { apiKey: string; model: string; accounts: Account[]; categories: Category[] }

function Chat({ apiKey, model, accounts, categories }: ChatProps) {
  const { items, busy, send, confirm, discard } = useAssistantChat({ apiKey, model, accounts, categories })
  const [text, setText] = useState('')
  const end = useRef<HTMLDivElement>(null)
  const accountNames = new Map(accounts.map((account) => [account.id, account.name]))
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]))

  // A conversa cresce para baixo: o fim dela fica sempre à vista. O jsdom não sabe rolar.
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'end' })
  }, [items, busy])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const message = text.trim()
    if (!message || busy) return
    setText('')
    // Se a chamada falhou, o texto volta para o campo para ser reenviado.
    if (!(await send(message))) setText(message)
  }

  return (
    <div className="grid gap-4">
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Escreva o que você gastou ou recebeu, como “gastei 45,90 no mercado ontem” ou “recebi 3.000 de salário hoje”.
          O assistente monta o lançamento e você confirma antes de gravar.
        </p>
      )}
      <ul aria-label="Conversa" className="grid gap-3">
        {items.map((item) =>
          item.kind === 'proposal' ? (
            <ProposalCard
              key={item.id}
              proposal={item}
              accountName={accountNames.get(item.values.account_id) ?? ''}
              categoryName={categoryNames.get(item.values.category_id) ?? ''}
              onConfirm={() => void confirm(item)}
              onDiscard={() => discard(item)}
            />
          ) : item.kind === 'error' ? (
            <li key={item.id}>
              <ErrorMessage>{item.text}</ErrorMessage>
            </li>
          ) : (
            <li
              key={item.id}
              className={
                item.kind === 'user'
                  ? 'ml-8 justify-self-end rounded-lg bg-primary px-3 py-2 text-sm whitespace-pre-wrap text-primary-foreground'
                  : 'mr-8 justify-self-start rounded-lg bg-muted px-3 py-2 text-sm whitespace-pre-wrap'
              }
            >
              <span className="sr-only">{item.kind === 'user' ? 'Você: ' : 'Assistente: '}</span>
              {item.text}
            </li>
          ),
        )}
      </ul>
      {busy && (
        <p role="status" className="text-sm text-muted-foreground">
          Pensando…
        </p>
      )}
      <form onSubmit={(event) => void submit(event)} className="flex gap-2">
        <Input
          aria-label="Mensagem"
          autoComplete="off"
          placeholder="Descreva o lançamento…"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <Button type="submit" disabled={busy || !text.trim()}>
          <Send aria-hidden />
          Enviar
        </Button>
      </form>
      <div ref={end} />
    </div>
  )
}

/** O assistente: um chat que cria lançamentos a partir do que o usuário escreve. */
export function Assistant() {
  const settings = useAssistantSettings()
  const accounts = useAccounts()
  const categories = useCategories()
  const title = 'Assistente'

  if (settings.isPending || accounts.isPending || categories.isPending) {
    return (
      <FormPage title={title} back={back}>
        <LoadingMessage />
      </FormPage>
    )
  }
  if (settings.isError || !accounts.data || !categories.data) {
    return (
      <FormPage title={title} back={back}>
        <ErrorMessage>Não foi possível carregar. Verifique sua conexão e tente de novo.</ErrorMessage>
      </FormPage>
    )
  }

  const { openrouter_key: apiKey, model } = settings.data ?? {}
  if (!apiKey || !model) {
    return (
      <FormPage title={title} back={back}>
        <p className="text-muted-foreground">
          Para usar o assistente, {apiKey ? 'escolha um modelo' : 'informe a sua chave do OpenRouter e escolha um modelo'}{' '}
          no{' '}
          <Link to="/perfil" className="text-primary underline">
            Perfil
          </Link>
          .
        </p>
      </FormPage>
    )
  }

  // Arquivadas não são oferecidas para novos lançamentos, nem ao modelo.
  const offeredAccounts = accounts.data.filter((account) => !account.archived)
  if (offeredAccounts.length === 0) {
    return (
      <FormPage title={title} back={back}>
        <p className="text-muted-foreground">
          Todo lançamento entra ou sai de uma conta.{' '}
          <Link to="/contas/nova" className="text-primary underline">
            Crie uma conta
          </Link>{' '}
          antes de lançar.
        </p>
      </FormPage>
    )
  }

  return (
    <FormPage title={title} back={back}>
      <Chat
        apiKey={apiKey}
        model={model}
        accounts={offeredAccounts}
        categories={categories.data.filter((category) => !category.archived)}
      />
    </FormPage>
  )
}
