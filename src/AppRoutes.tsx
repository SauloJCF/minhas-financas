import { Navigate, Route, Routes } from 'react-router'
import { RequireAuth, RequireSignedOut } from '@/auth/guards'
import { AppLayout } from '@/components/AppLayout'
import { ContaEdit } from '@/pages/ContaEdit'
import { Contas } from '@/pages/Contas'
import { ForgotPassword } from '@/pages/ForgotPassword'
import { Home } from '@/pages/Home'
import { Login } from '@/pages/Login'
import { Profile } from '@/pages/Profile'
import { SetPassword } from '@/pages/SetPassword'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<RequireSignedOut />}>
        <Route path="/login" element={<Login />} />
        <Route path="/esqueci-senha" element={<ForgotPassword />} />
      </Route>

      {/* Aberta com ou sem sessão: é o destino dos links enviados por e-mail. */}
      <Route path="/definir-senha" element={<SetPassword />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/contas" element={<Contas />} />
          <Route path="/contas/nova" element={<ContaEdit />} />
          <Route path="/contas/:id" element={<ContaEdit />} />
          <Route path="/perfil" element={<Profile />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
