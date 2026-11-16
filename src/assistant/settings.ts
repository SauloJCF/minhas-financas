import { useQuery } from '@tanstack/react-query'
import type { Tables } from '@/lib/database.types'
import { useDbMutation, useUserQueryKey } from '@/lib/db'
import { supabase } from '@/lib/supabase'

/** As configurações do assistente de um usuário: chave do OpenRouter, modelo e filtro de gratuitos. */
export type AssistantSettings = Tables<'assistant_settings'>

export type AssistantSettingsInput = Pick<AssistantSettings, 'openrouter_key' | 'model' | 'free_only'>

/** As configurações do usuário; `null` enquanto ele nunca salvou nenhuma. */
export function useAssistantSettings() {
  return useQuery({
    queryKey: useUserQueryKey('assistant_settings'),
    queryFn: async (): Promise<AssistantSettings | null> => {
      const { data, error } = await supabase.from('assistant_settings').select('*')
      if (error) throw error
      return data[0] ?? null
    },
  })
}

/** Grava as configurações: cria a linha do usuário na primeira vez, altera nas seguintes. */
export function useSaveAssistantSettings() {
  return useDbMutation(['assistant_settings'], async (values: AssistantSettingsInput) => {
    const { error } = await supabase.from('assistant_settings').upsert(values, { onConflict: 'user_id' })
    if (error) throw error
  })
}
