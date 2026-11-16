import { createClient } from '@supabase/supabase-js'
import { routeEmailLink } from '@/auth/email-link'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Faltam VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY. Copie .env.example para .env.development.local e preencha.',
  )
}

// Antes de criar o cliente: ele lê a sessão do fragmento da URL ao iniciar.
routeEmailLink()

export const supabase = createClient<Database>(url, anonKey)
