import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// O service worker não existe no jsdom; os testes usam um registro inerte.
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}))

// Com a suíte inteira rodando em paralelo, uma tela que encadeia várias consultas pode passar
// do 1 s padrão do `findBy` em máquinas lentas.
configure({ asyncUtilTimeout: 3000 })

afterEach(cleanup)
