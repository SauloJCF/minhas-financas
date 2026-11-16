import { useQuery } from '@tanstack/react-query'
import type { Database, Tables, TablesInsert } from '@/lib/database.types'
import { useDbMutation, useUserQueryKey } from '@/lib/db'
import { supabase } from '@/lib/supabase'

export type AccountType = Database['public']['Enums']['account_type']

/** Uma conta com os saldos, que são calculados pela view e nunca armazenados. */
export type Account = Omit<Tables<'accounts_with_balance'>, 'current_balance' | 'forecast_balance'> & {
  /** Saldo inicial mais os lançamentos pagos. */
  current_balance: number
  /** Saldo atual mais os lançamentos pendentes. */
  forecast_balance: number
}

export type AccountInput = Pick<
  TablesInsert<'accounts'>,
  'name' | 'type' | 'initial_balance' | 'initial_balance_date' | 'color' | 'icon'
>

/** Tipos de conta, na ordem em que agrupam a lista. O ícone é a sugestão ao criar. */
export const ACCOUNT_TYPES = [
  { value: 'corrente', label: 'Conta corrente', plural: 'Contas correntes', icon: 'landmark' },
  { value: 'poupanca', label: 'Poupança', plural: 'Poupanças', icon: 'piggy-bank' },
  { value: 'dinheiro', label: 'Dinheiro', plural: 'Dinheiro', icon: 'wallet' },
  { value: 'cartao', label: 'Cartão', plural: 'Cartões', icon: 'credit-card' },
  { value: 'investimento', label: 'Investimento', plural: 'Investimentos', icon: 'trending-up' },
] as const satisfies readonly { value: AccountType; label: string; plural: string; icon: string }[]

/** Todas as contas do usuário, arquivadas inclusive, em ordem alfabética. */
export function useAccounts() {
  return useQuery({
    queryKey: useUserQueryKey('accounts'),
    queryFn: async (): Promise<Account[]> => {
      const { data, error } = await supabase.from('accounts_with_balance').select('*').order('name')
      if (error) throw error
      // Os tipos gerados dão colunas calculadas como anuláveis; a view nunca devolve nulo nelas.
      return data as Account[]
    },
  })
}

/** Cria a conta ou, com `id`, altera a que já existe. */
export function useSaveAccount() {
  return useDbMutation(['accounts'], async ({ id, values }: { id?: string; values: AccountInput }) => {
    const { error } = id
      ? await supabase.from('accounts').update(values).eq('id', id)
      : await supabase.from('accounts').insert(values)
    if (error) throw error
  })
}

/** Arquiva ou desarquiva. */
export function useArchiveAccount() {
  return useDbMutation(['accounts'], async ({ id, archived }: { id: string; archived: boolean }) => {
    const { error } = await supabase.from('accounts').update({ archived }).eq('id', id)
    if (error) throw error
  })
}

export function useDeleteAccount() {
  return useDbMutation(['accounts'], async (id: string) => {
    const { error } = await supabase.from('accounts').delete().eq('id', id)
    if (error) throw error
  })
}
