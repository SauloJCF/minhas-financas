import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/auth-context'
import type { Tables, TablesInsert } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

/** Uma conta com o saldo atual, que é calculado pela view e nunca armazenado. */
export type Conta = Tables<'contas_com_saldo'>

export type ContaInput = Pick<
  TablesInsert<'contas'>,
  'nome' | 'tipo' | 'saldo_inicial' | 'data_saldo_inicial' | 'cor' | 'icone'
>

// O usuário entra na chave para o cache de um nunca ser mostrado a outro no mesmo aparelho.
function useContasKey() {
  const { session } = useAuth()
  return ['contas', session?.user.id]
}

/** Todas as contas do usuário, arquivadas inclusive, em ordem alfabética. */
export function useContas() {
  return useQuery({
    queryKey: useContasKey(),
    queryFn: async (): Promise<Conta[]> => {
      const { data, error } = await supabase.from('contas_com_saldo').select('*').order('nome')
      if (error) throw error
      return data
    },
  })
}

function useContaMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<void>) {
  const queryClient = useQueryClient()
  const queryKey = useContasKey()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })
}

/** Cria a conta ou, com `id`, altera a que já existe. */
export function useSalvarConta() {
  return useContaMutation(async ({ id, values }: { id?: string; values: ContaInput }) => {
    const { error } = id
      ? await supabase.from('contas').update(values).eq('id', id)
      : await supabase.from('contas').insert(values)
    if (error) throw error
  })
}

/** Arquiva ou desarquiva. */
export function useArquivarConta() {
  return useContaMutation(async ({ id, arquivada }: { id: string; arquivada: boolean }) => {
    const { error } = await supabase.from('contas').update({ arquivada }).eq('id', id)
    if (error) throw error
  })
}

export function useExcluirConta() {
  return useContaMutation(async (id: string) => {
    const { error } = await supabase.from('contas').delete().eq('id', id)
    if (error) throw error
  })
}

/** Traduz um erro do banco para uma mensagem que o usuário entende. */
export function contaErrorMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code
  // 23503: outra tabela ainda aponta para a conta (lançamentos ou transferências).
  if (code === '23503') {
    return 'Esta conta tem lançamentos ou transferências e não pode ser excluída. Arquive-a.'
  }
  return 'Não foi possível concluir. Verifique sua conexão e tente de novo.'
}
