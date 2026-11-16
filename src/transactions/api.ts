import { useQuery } from '@tanstack/react-query'
import type { Tables, TablesInsert } from '@/lib/database.types'
import { monthRange } from '@/lib/dates'
import { useDbMutation, useUserQueryKey } from '@/lib/db'
import { supabase } from '@/lib/supabase'

/** Um lançamento: receita (`income`) ou despesa (`expense`). */
export type Transaction = Tables<'transactions'>

export type TransactionInput = Pick<
  TablesInsert<'transactions'>,
  'type' | 'description' | 'amount' | 'account_id' | 'category_id' | 'due_date' | 'paid_at' | 'notes'
>

/** Pago, pendente ou vencido (pendente cujo vencimento já passou). */
export type TransactionStatus = 'paid' | 'pending' | 'overdue'

export function statusOf(transaction: Pick<Transaction, 'paid_at' | 'due_date'>, today: string): TransactionStatus {
  if (transaction.paid_at) return 'paid'
  return transaction.due_date < today ? 'overdue' : 'pending'
}

/** O valor com o sinal do tipo: receita soma, despesa subtrai. */
export function signedAmount(transaction: Pick<Transaction, 'type' | 'amount'>): number {
  return transaction.type === 'income' ? transaction.amount : -transaction.amount
}

// Gravar um lançamento muda também os saldos das contas.
const INVALIDATES = ['transactions', 'accounts']

/** Os lançamentos com vencimento no mês ("2026-11"), em ordem de vencimento. */
export function useTransactions(month: string) {
  return useQuery({
    queryKey: useUserQueryKey('transactions', 'month', month),
    queryFn: async (): Promise<Transaction[]> => {
      const { first, last } = monthRange(month)
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .gte('due_date', first)
        .lte('due_date', last)
        .order('due_date')
        .order('created_at')
      if (error) throw error
      return data
    },
  })
}

/** Um lançamento pelo id; `null` se não existe ou é de outro usuário. */
export function useTransaction(id: string | undefined) {
  return useQuery({
    queryKey: useUserQueryKey('transactions', 'one', id),
    enabled: Boolean(id),
    queryFn: async (): Promise<Transaction | null> => {
      const { data, error } = await supabase.from('transactions').select('*').eq('id', id!)
      if (error) throw error
      return data[0] ?? null
    },
  })
}

/** Cria o lançamento ou, com `id`, altera o que já existe. */
export function useSaveTransaction() {
  return useDbMutation(INVALIDATES, async ({ id, values }: { id?: string; values: TransactionInput }) => {
    const { error } = id
      ? await supabase.from('transactions').update(values).eq('id', id)
      : await supabase.from('transactions').insert(values)
    if (error) throw error
  })
}

/** Marca como pago na data dada, ou desfaz o pagamento com `null`. */
export function useSetPaid() {
  return useDbMutation(INVALIDATES, async ({ id, paidAt }: { id: string; paidAt: string | null }) => {
    const { error } = await supabase.from('transactions').update({ paid_at: paidAt }).eq('id', id)
    if (error) throw error
  })
}

/** Exclui de verdade: lançamentos não têm lixeira. */
export function useDeleteTransaction() {
  return useDbMutation(INVALIDATES, async (id: string) => {
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) throw error
  })
}
