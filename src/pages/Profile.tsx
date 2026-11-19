import { useQueryClient } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { AssistantSettingsSection } from '@/assistant/AssistantSettingsForm'
import { useAuth } from '@/auth/auth-context'
import { NewPasswordForm } from '@/components/NewPasswordForm'
import { Button } from '@/components/ui/button'
import { clearUserCache } from '@/lib/offline'
import { supabase } from '@/lib/supabase'

export function Profile() {
  const { session } = useAuth()
  const [saved, setSaved] = useState(false)
  const queryClient = useQueryClient()

  async function signOut() {
    // Sem rede, o Supabase não consegue encerrar a sessão no servidor; ela sai pelo menos do aparelho.
    const { error } = await supabase.auth.signOut()
    if (error) await supabase.auth.signOut({ scope: 'local' })
    // Os dados de um usuário não ficam no aparelho depois que ele sai.
    await clearUserCache(queryClient)
  }

  async function changePassword(password: string) {
    setSaved(false)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
    setSaved(true)
  }

  return (
    <div className="mx-auto grid max-w-sm gap-8">
      <section className="grid gap-1">
        <h1 className="text-xl font-semibold">Perfil</h1>
        <p className="text-sm text-muted-foreground">{session?.user.email}</p>
      </section>

      <section className="grid gap-4">
        <h2 className="font-medium">Trocar senha</h2>
        <NewPasswordForm submitLabel="Trocar senha" onSubmit={changePassword} />
        {saved && (
          <p role="status" className="text-sm text-primary">
            Senha alterada.
          </p>
        )}
      </section>

      <AssistantSettingsSection />

      <Link to="/tickets" className="flex items-center gap-3 rounded-xl border px-3 py-3 hover:bg-muted">
        <span className="grid flex-1 gap-0.5">
          <span className="font-medium">Tickets</span>
          <span className="text-xs text-muted-foreground">Peça uma melhoria ou relate um problema</span>
        </span>
        <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
      </Link>

      <Button variant="outline" onClick={() => void signOut()}>
        Sair
      </Button>

      <p className="text-center text-xs text-muted-foreground">versão {__APP_VERSION__}</p>
    </div>
  )
}
