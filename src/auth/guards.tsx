import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './auth-context'

function Loading() {
  return (
    <div role="status" className="flex min-h-dvh items-center justify-center text-muted-foreground">
      Carregando…
    </div>
  )
}

/** Rotas do app: sem sessão, manda para o login e lembra de onde a pessoa veio. */
export function RequireAuth() {
  const auth = useAuth()
  const location = useLocation()
  if (auth.status === 'loading') return <Loading />
  if (auth.status === 'signedOut') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}

/** Login e "esqueci a senha": quem já está logado vai direto para o app. */
export function RequireSignedOut() {
  const auth = useAuth()
  const location = useLocation()
  if (auth.status === 'loading') return <Loading />
  if (auth.status === 'signedIn') {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from ?? '/'} replace />
  }
  return <Outlet />
}
