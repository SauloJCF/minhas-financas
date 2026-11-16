import { useRef, useState } from 'react'
import { today } from '@/lib/dates'
import { dbErrorMessage } from '@/lib/db'
import { useSaveTransaction, type TransactionInput } from '@/transactions/api'
import { chat, OpenRouterError, type ChatMessage } from './openrouter'
import { CREATE_TRANSACTION_TOOL, parseProposal, systemPrompt, TOOL_NAME, type ProposalContext } from './proposal'

/** Um lançamento que o modelo propôs, à espera do usuário. */
export type Proposal = {
  kind: 'proposal'
  id: number
  /** A chamada de ferramenta que o gerou: o resultado volta ao modelo com este id. */
  callId: string
  values: TransactionInput
  status: 'pending' | 'saving' | 'created' | 'discarded'
  /** Por que a última tentativa de gravar falhou. */
  error?: string
}

/** O que aparece na conversa, em ordem. */
export type ChatItem = { kind: 'user' | 'assistant' | 'error'; id: number; text: string } | Proposal

type Options = {
  apiKey: string
  model: string
  accounts: ProposalContext['accounts']
  categories: ProposalContext['categories']
}

// Quantas vezes seguidas o modelo pode errar a chamada da ferramenta antes de o app desistir.
const MAX_ROUNDS = 3

const toolResult = (callId: string, result: Record<string, string>): ChatMessage => ({
  role: 'tool',
  tool_call_id: callId,
  content: JSON.stringify(result),
})

const DISCARDED = { status: 'descartado', detail: 'O usuário descartou. Nada foi gravado.' }

/**
 * A conversa com o assistente. Ela vive só na memória desta tela. O modelo propõe
 * lançamentos; nada é gravado sem o usuário confirmar.
 */
export function useAssistantChat({ apiKey, model, accounts, categories }: Options) {
  const [items, setItems] = useState<ChatItem[]>([])
  const [busy, setBusy] = useState(false)
  // A conversa como o modelo a vê. Cada resultado de ferramenta entra aqui quando o usuário
  // decide, e segue para o modelo junto com a próxima mensagem.
  const history = useRef<ChatMessage[]>([])
  const nextId = useRef(1)
  const save = useSaveTransaction()

  const newId = () => nextId.current++
  const patch = (id: number, changes: Partial<Proposal>) =>
    setItems((previous) => previous.map((item) => (item.id === id ? ({ ...item, ...changes } as ChatItem) : item)))

  async function run() {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const context = { accounts, categories, today: today() }
      const reply = await chat({
        key: apiKey,
        model,
        messages: [{ role: 'system', content: systemPrompt(context) }, ...history.current],
        tools: [CREATE_TRANSACTION_TOOL],
      })
      history.current.push(reply)

      const added: ChatItem[] = []
      if (reply.content) added.push({ kind: 'assistant', id: newId(), text: reply.content })
      let waiting = false
      for (const call of reply.tool_calls ?? []) {
        const parsed =
          call.function.name === TOOL_NAME
            ? parseProposal(call.function.arguments, context)
            : ({ ok: false, error: 'Ferramenta desconhecida.' } as const)
        if (parsed.ok) {
          waiting = true
          added.push({ kind: 'proposal', id: newId(), callId: call.id, values: parsed.values, status: 'pending' })
        } else {
          history.current.push(toolResult(call.id, { status: 'erro', detail: parsed.error }))
        }
      }
      if (!reply.content && !reply.tool_calls) {
        added.push({ kind: 'error', id: newId(), text: 'O modelo não respondeu nada. Tente de novo ou escolha outro modelo no Perfil.' })
      }
      setItems((previous) => [...previous, ...added])
      // Só continua sozinho quando todas as chamadas vieram erradas: o modelo recebe os erros e tenta de novo.
      if (waiting || !reply.tool_calls) return
    }
    setItems((previous) => [
      ...previous,
      { kind: 'error', id: newId(), text: 'O modelo não conseguiu montar o lançamento. Tente descrever de outro jeito.' },
    ])
  }

  /** Envia a mensagem do usuário. Devolve `false` se a chamada falhou e a mensagem não entrou na conversa. */
  async function send(text: string): Promise<boolean> {
    // Quem escreve de novo sem decidir uma proposta a descartou: o modelo fica sabendo.
    const abandoned = items.filter((item): item is Proposal => item.kind === 'proposal' && item.status === 'pending')
    for (const proposal of abandoned) history.current.push(toolResult(proposal.callId, DISCARDED))
    const mark = history.current.length
    history.current.push({ role: 'user', content: text })

    const userItem: ChatItem = { kind: 'user', id: newId(), text }
    setItems((previous) => [
      ...previous
        .filter((item) => item.kind !== 'error')
        .map((item) => (abandoned.some((proposal) => proposal.id === item.id) ? ({ ...item, status: 'discarded' } as ChatItem) : item)),
      userItem,
    ])
    setBusy(true)
    try {
      await run()
      return true
    } catch (error) {
      // A mensagem sai da conversa para poder ser reenviada sem duplicar.
      history.current.length = mark
      const message = error instanceof OpenRouterError ? error.message : new OpenRouterError('unknown').message
      setItems((previous) => [
        ...previous.filter((item) => item.id !== userItem.id),
        { kind: 'error', id: newId(), text: message },
      ])
      return false
    } finally {
      setBusy(false)
    }
  }

  /** Grava o lançamento proposto, pelo mesmo caminho do formulário. */
  async function confirm(proposal: Proposal) {
    patch(proposal.id, { status: 'saving', error: undefined })
    try {
      await save.mutateAsync({ values: proposal.values })
    } catch (error) {
      patch(proposal.id, { status: 'pending', error: dbErrorMessage(error) })
      return
    }
    history.current.push(toolResult(proposal.callId, { status: 'criado', detail: 'O usuário confirmou e o lançamento foi gravado.' }))
    patch(proposal.id, { status: 'created' })
  }

  function discard(proposal: Proposal) {
    history.current.push(toolResult(proposal.callId, DISCARDED))
    patch(proposal.id, { status: 'discarded' })
  }

  return { items, busy, send, confirm, discard }
}
