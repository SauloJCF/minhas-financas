import { useState } from 'react'
import { AssistantSettingsSection } from '@/assistant/AssistantSettingsForm'
import { useAuth } from '@/auth/auth-context'
import { NewPasswordForm } from '@/components/NewPasswordForm'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'

export function Profile() {
  const { session } = useAuth()
  const [saved, setSaved] = useState(false)

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

      <Button variant="outline" onClick={() => void supabase.auth.signOut()}>
        Sair
      </Button>

      <p className="text-center text-xs text-muted-foreground">versão {__APP_VERSION__}</p>
    </div>
  )
}
