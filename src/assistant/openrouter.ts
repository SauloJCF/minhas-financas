// Cliente do OpenRouter. O navegador fala direto com ele, com a chave do próprio usuário
// (ADR 0008). A chave só sai daqui no cabeçalho `Authorization`, e só para o OpenRouter.
import { useQuery } from '@tanstack/react-query'

const API = 'https://openrouter.ai/api/v1'

/** Um modelo que o assistente pode usar: só entram os que aceitam ferramentas. */
export type Model = {
  id: string
  name: string
  free: boolean
  /** Preço em dólares por milhão de tokens, de entrada e de saída. */
  inputPrice: number
  outputPrice: number
}

type ApiModel = {
  id: string
  name?: string
  pricing?: { prompt?: string; completion?: string }
  supported_parameters?: string[]
}

/** A lista pública de modelos, em ordem alfabética. Não precisa de chave. */
export async function fetchModels(): Promise<Model[]> {
  const response = await fetch(`${API}/models`)
  if (!response.ok) throw new Error(`models: ${response.status}`)
  const body = (await response.json()) as { data: ApiModel[] }
  return body.data
    .filter((model) => model.supported_parameters?.includes('tools'))
    .map((model) => {
      const input = Number(model.pricing?.prompt ?? NaN)
      const output = Number(model.pricing?.completion ?? NaN)
      return {
        id: model.id,
        // O OpenRouter põe "(free)" no fim do nome dos gratuitos; o seletor já diz isso em português.
        name: (model.name ?? model.id).replace(/\s*\(free\)$/i, ''),
        // Sem preço conhecido, o modelo não é tratado como gratuito.
        free: input === 0 && output === 0,
        inputPrice: input * 1_000_000,
        outputPrice: output * 1_000_000,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function useModels() {
  return useQuery({
    queryKey: ['openrouter', 'models'],
    queryFn: fetchModels,
    // A lista muda pouco dentro de uma sessão.
    staleTime: 60 * 60 * 1000,
  })
}

const usd = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' })

/** Como o modelo aparece no seletor: o nome e quanto custa. */
export function modelLabel(model: Model): string {
  if (model.free) return `${model.name} (gratuito)`
  if (Number.isNaN(model.inputPrice) || Number.isNaN(model.outputPrice)) return `${model.name} (pago)`
  return `${model.name} (${usd.format(model.inputPrice)} + ${usd.format(model.outputPrice)} por milhão de tokens)`
}

export type ToolCall = {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

/** Uma mensagem da conversa, no formato da API de chat. */
export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string }

export type AssistantReply = Extract<ChatMessage, { role: 'assistant' }>

export type OpenRouterErrorKind = 'invalid_key' | 'no_credit' | 'rate_limit' | 'model_unavailable' | 'network' | 'unknown'

const ERROR_MESSAGES: Record<OpenRouterErrorKind, string> = {
  invalid_key: 'O OpenRouter recusou a chave. Confira a chave no Perfil.',
  no_credit: 'A chave não tem crédito para este modelo. Escolha um modelo gratuito ou adicione crédito no OpenRouter.',
  rate_limit: 'O limite de uso deste modelo foi atingido. Espere um pouco ou escolha outro modelo no Perfil.',
  model_unavailable: 'Este modelo não está disponível agora. Escolha outro no Perfil.',
  network: 'Não foi possível falar com o OpenRouter. Verifique sua conexão e tente de novo.',
  unknown: 'O OpenRouter devolveu um erro. Tente de novo em instantes.',
}

/** Erro de uma chamada ao OpenRouter, já com a mensagem que o usuário vê. Nunca carrega a chave. */
export class OpenRouterError extends Error {
  kind: OpenRouterErrorKind

  constructor(kind: OpenRouterErrorKind) {
    super(ERROR_MESSAGES[kind])
    this.name = 'OpenRouterError'
    this.kind = kind
  }
}

function kindOf(status: number): OpenRouterErrorKind {
  if (status === 401 || status === 403) return 'invalid_key'
  if (status === 402) return 'no_credit'
  if (status === 429) return 'rate_limit'
  if (status === 400 || status === 404 || status === 502 || status === 503) return 'model_unavailable'
  return 'unknown'
}

type ChatRequest = {
  key: string
  model: string
  messages: ChatMessage[]
  tools: unknown[]
}

/** Pede a próxima resposta do modelo: um texto, uma ou mais chamadas de ferramenta, ou os dois. */
export async function chat({ key, model, messages, tools }: ChatRequest): Promise<AssistantReply> {
  let response: Response
  try {
    response = await fetch(`${API}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, tools }),
    })
  } catch {
    throw new OpenRouterError('network')
  }
  if (!response.ok) throw new OpenRouterError(kindOf(response.status))

  let body: { error?: { code?: number }; choices?: { message?: Partial<AssistantReply> }[] }
  try {
    body = await response.json()
  } catch {
    throw new OpenRouterError('unknown')
  }
  // O provedor do modelo pode falhar depois de o OpenRouter já ter respondido 200.
  if (body.error) throw new OpenRouterError(kindOf(Number(body.error.code)))
  const message = body.choices?.[0]?.message
  if (!message) throw new OpenRouterError('unknown')
  const toolCalls = message.tool_calls?.length ? message.tool_calls : undefined
  return { role: 'assistant', content: message.content || null, ...(toolCalls && { tool_calls: toolCalls }) }
}
