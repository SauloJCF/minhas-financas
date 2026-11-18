import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { setValuesHidden } from '@/lib/hidden-values'

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

// Nenhum teste fala com a internet: quem precisa do OpenRouter troca este `fetch` por um falso.
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new Error('fetch não simulado neste teste')
    }),
  )
})

afterEach(() => {
  cleanup()
  // O estado dos valores ocultos mora no módulo e no localStorage: cada teste começa visível.
  setValuesHidden(false)
})
