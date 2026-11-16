import { useQuery } from '@tanstack/react-query'
import { monthRange } from '@/lib/dates'
import { useUserQueryKey } from '@/lib/db'
import { supabase } from '@/lib/supabase'

/** Uma linha do extrato de uma conta: um lançamento ou um dos lados de uma transferência. */
export type StatementEntry = {
  /** O id do lançamento ou da transferência. */
  id: string
  account_id: string
  kind: 'transaction' | 'transfer'
  /** O pagamento do lançamento (ou o vencimento, se pendente), ou a data da transferência. */
  date: string
  /** A descrição do lançamento, ou a observação da transferência. */
  description: string | null
  /** Em centavos, já com sinal: positivo entra na conta, negativo sai. */
  amount: number
  /** Falso para lançamento pendente, que ainda não mexeu no saldo. */
  settled: boolean
  /** Em transferência, a conta do outro lado. */
  other_account_id: string | null
  created_at: string
}

/** O extrato de uma conta no mês ("2026-11"), do mais recente para o mais antigo. */
export function useStatement(accountId: string, month: string) {
  return useQuery({
    queryKey: useUserQueryKey('statement', accountId, month),
    queryFn: async (): Promise<StatementEntry[]> => {
      const { first, last } = monthRange(month)
      const { data, error } = await supabase
        .from('account_statement')
        .select('*')
        .eq('account_id', accountId)
        .gte('date', first)
        .lte('date', last)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      // Os tipos gerados dão toda coluna de view com UNION como anulável; só as duas marcadas acima são.
      return data as StatementEntry[]
    },
  })
}
