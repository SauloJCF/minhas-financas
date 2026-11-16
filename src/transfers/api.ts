import { useQuery } from '@tanstack/react-query'
import type { Tables, TablesInsert } from '@/lib/database.types'
import { monthRange } from '@/lib/dates'
import { useDbMutation, useUserQueryKey } from '@/lib/db'
import { supabase } from '@/lib/supabase'

/** Uma transferência entre duas contas do usuário. Não é receita nem despesa (ADR 0003). */
export type Transfer = Tables<'transfers'>

export type TransferInput = Pick<
  TablesInsert<'transfers'>,
  'from_account_id' | 'to_account_id' | 'amount' | 'date' | 'notes'
>

// Gravar uma transferência muda os saldos e o extrato das duas contas.
const INVALIDATES = ['transfers', 'accounts', 'statement']

/** As transferências do mês ("2026-11"), da mais recente para a mais antiga. */
export function useTransfers(month: string) {
  return useQuery({
    queryKey: useUserQueryKey('transfers', 'month', month),
    queryFn: async (): Promise<Transfer[]> => {
      const { first, last } = monthRange(month)
      const { data, error } = await supabase
        .from('transfers')
        .select('*')
        .gte('date', first)
        .lte('date', last)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

/** Uma transferência pelo id; `null` se não existe ou é de outro usuário. */
export function useTransfer(id: string | undefined) {
  return useQuery({
    queryKey: useUserQueryKey('transfers', 'one', id),
    enabled: Boolean(id),
    queryFn: async (): Promise<Transfer | null> => {
      const { data, error } = await supabase.from('transfers').select('*').eq('id', id!)
      if (error) throw error
      return data[0] ?? null
    },
  })
}

/** Cria a transferência ou, com `id`, altera a que já existe. */
export function useSaveTransfer() {
  return useDbMutation(INVALIDATES, async ({ id, values }: { id?: string; values: TransferInput }) => {
    const { error } = id
      ? await supabase.from('transfers').update(values).eq('id', id)
      : await supabase.from('transfers').insert(values)
    if (error) throw error
  })
}

/** Exclui de verdade: transferências não têm lixeira. */
export function useDeleteTransfer() {
  return useDbMutation(INVALIDATES, async (id: string) => {
    const { error } = await supabase.from('transfers').delete().eq('id', id)
    if (error) throw error
  })
}
