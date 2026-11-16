import { useQuery } from '@tanstack/react-query'
import type { Database, Tables, TablesInsert } from '@/lib/database.types'
import { useDbMutation, useUserQueryKey } from '@/lib/db'
import { supabase } from '@/lib/supabase'

/** Receita ou despesa: classifica categorias e lançamentos. */
export type TransactionType = Database['public']['Enums']['transaction_type']

export type Category = Tables<'categories'>

export type CategoryInput = Pick<
  TablesInsert<'categories'>,
  'name' | 'type' | 'color' | 'icon' | 'monthly_budget'
>

/** Os dois tipos, na ordem em que aparecem: despesas primeiro, que são a maioria. */
export const TRANSACTION_TYPES = [
  { value: 'expense', label: 'Despesa', plural: 'Despesas' },
  { value: 'income', label: 'Receita', plural: 'Receitas' },
] as const satisfies readonly { value: TransactionType; label: string; plural: string }[]

/** Todas as categorias do usuário, arquivadas inclusive, em ordem alfabética. */
export function useCategories() {
  return useQuery({
    queryKey: useUserQueryKey('categories'),
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase.from('categories').select('*').order('name')
      if (error) throw error
      return data
    },
  })
}

/** Cria a categoria ou, com `id`, altera a que já existe. O tipo não muda depois de criada. */
export function useSaveCategory() {
  return useDbMutation(['categories'], async ({ id, values }: { id?: string; values: CategoryInput }) => {
    const { name, color, icon, monthly_budget } = values
    const { error } = id
      ? await supabase.from('categories').update({ name, color, icon, monthly_budget }).eq('id', id)
      : await supabase.from('categories').insert(values)
    if (error) throw error
  })
}

/** Arquiva ou desarquiva. */
export function useArchiveCategory() {
  return useDbMutation(['categories'], async ({ id, archived }: { id: string; archived: boolean }) => {
    const { error } = await supabase.from('categories').update({ archived }).eq('id', id)
    if (error) throw error
  })
}

export function useDeleteCategory() {
  return useDbMutation(['categories'], async (id: string) => {
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) throw error
  })
}
