import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { BrowserRouter } from 'react-router'
import { AppRoutes } from './AppRoutes'
import { AuthProvider } from './auth/AuthProvider'
import { UpdatePrompt } from './components/UpdatePrompt'
import { createQueryClient, persistOptions } from './lib/offline'

const queryClient = createQueryClient()

export default function App() {
  return (
    // O cache vai para o aparelho e volta ao abrir o app: sem rede, ele mostra o que já carregou.
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
        <UpdatePrompt />
      </AuthProvider>
    </PersistQueryClientProvider>
  )
}
