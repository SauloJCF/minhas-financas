import { Navigate, Route, Routes } from 'react-router'
import { RequireAuth, RequireSignedOut } from '@/auth/guards'
import { AppLayout } from '@/components/AppLayout'
import { AccountEdit } from '@/pages/AccountEdit'
import { Accounts } from '@/pages/Accounts'
import { AccountStatement } from '@/pages/AccountStatement'
import { CardStatement } from '@/pages/CardStatement'
import { Categories } from '@/pages/Categories'
import { CategoryEdit } from '@/pages/CategoryEdit'
import { Dashboard } from '@/pages/Dashboard'
import { ForgotPassword } from '@/pages/ForgotPassword'
import { Login } from '@/pages/Login'
import { Profile } from '@/pages/Profile'
import { Reports } from '@/pages/Reports'
import { SetPassword } from '@/pages/SetPassword'
import { TransactionEdit } from '@/pages/TransactionEdit'
import { Transactions } from '@/pages/Transactions'
import { TransactionsExport } from '@/pages/TransactionsExport'
import { TransferEdit } from '@/pages/TransferEdit'
import { Transfers } from '@/pages/Transfers'

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
          <Route path="/" element={<Dashboard />} />
          <Route path="/lancamentos" element={<Transactions />} />
          <Route path="/lancamentos/novo" element={<TransactionEdit />} />
          <Route path="/lancamentos/exportar" element={<TransactionsExport />} />
          <Route path="/lancamentos/:id" element={<TransactionEdit />} />
          <Route path="/contas" element={<Accounts />} />
          <Route path="/contas/nova" element={<AccountEdit />} />
          <Route path="/contas/:id" element={<AccountStatement />} />
          <Route path="/contas/:id/editar" element={<AccountEdit />} />
          <Route path="/contas/:id/fatura" element={<CardStatement />} />
          <Route path="/transferencias" element={<Transfers />} />
          <Route path="/transferencias/nova" element={<TransferEdit />} />
          <Route path="/transferencias/:id" element={<TransferEdit />} />
          <Route path="/categorias" element={<Categories />} />
          <Route path="/categorias/nova" element={<CategoryEdit />} />
          <Route path="/categorias/:id" element={<CategoryEdit />} />
          <Route path="/relatorios" element={<Reports />} />
          <Route path="/perfil" element={<Profile />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
