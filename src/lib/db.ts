import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/auth-context'

/**
 * Chave de cache de uma consulta. O usuário entra nela para o cache de um nunca ser
 * mostrado a outro no mesmo aparelho.
 */
export function useUserQueryKey(name: string, ...rest: unknown[]) {
  const { session } = useAuth()
  return [name, session?.user.id, ...rest]
}

/** Mutação que, ao dar certo, recarrega as consultas cujas chaves começam por `invalidates`. */
export function useDbMutation<TVariables>(
  invalidates: string[],
  mutationFn: (variables: TVariables) => Promise<void>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all(invalidates.map((name) => queryClient.invalidateQueries({ queryKey: [name] }))),
  })
}

/**
 * Traduz um erro do banco para uma mensagem que o usuário entende. `inUseMessage` responde
 * ao erro 23503: outra tabela ainda aponta para a linha que se tentou excluir.
 */
export function dbErrorMessage(error: unknown, inUseMessage?: string): string {
  const code = (error as { code?: string } | null)?.code
  if (code === '23503' && inUseMessage) return inUseMessage
  return 'Não foi possível concluir. Verifique sua conexão e tente de novo.'
}
