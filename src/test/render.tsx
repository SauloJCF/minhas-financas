import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { AppRoutes } from '@/AppRoutes'
import { AuthProvider } from '@/auth/AuthProvider'
import { formatBRL } from '@/lib/money'

/** Abre o app inteiro em uma rota, como o usuário o veria. */
export function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  )
  return userEvent.setup()
}

/** Um valor como aparece na tela. O Intl separa "R$" do número com um espaço não separável. */
export function brl(centavos: number): string {
  return formatBRL(centavos).replace(/\s/g, ' ')
}
