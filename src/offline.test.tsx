import { dehydrate, QueryClient } from '@tanstack/react-query'
import { act, screen } from '@testing-library/react'
import * as idb from 'idb-keyval'
import { beforeEach, expect, test, vi } from 'vitest'
import { persistOptions } from '@/lib/offline'
import { db } from '@/test/fake-supabase'
import { renderAt } from '@/test/render'

vi.mock('@/lib/supabase', () => import('@/test/fake-supabase'))

/** O Map que faz o papel do IndexedDB nos testes (ver `src/test/setup.ts`). */
const store = (idb as unknown as { store: Map<string, unknown> }).store

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 16, 12, 30))

  db.reset()
  store.clear()
  db.tables.accounts = [
    { id: 'nubank', name: 'Nubank', type: 'corrente', initial_balance: 100000, initial_balance_date: '2026-11-01', color: '#9333ea', icon: 'landmark', archived: false },
  ]
  db.tables.categories = [
    { id: 'food', name: 'Alimentação', type: 'expense', color: '#ea580c', icon: 'utensils', archived: false },
  ]
  db.tables.transactions = [
    { id: 'a', type: 'expense', description: 'Mercado', amount: 25000, account_id: 'nubank', category_id: 'food', due_date: '2026-11-10', paid_at: null, notes: null, created_at: '0' },
  ]
  networkUp = true
  const onLine = vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => networkUp)
  return () => {
    vi.useRealTimers()
    onLine.mockRestore()
  }
})

/** Liga e desliga a rede como o navegador faz: muda o `navigator.onLine` e avisa com um evento. */
let networkUp = true
function setNetwork(up: boolean) {
  networkUp = up
  act(() => void window.dispatchEvent(new Event(up ? 'online' : 'offline')))
}
const goOffline = () => setNetwork(false)
const goOnline = () => setNetwork(true)

test('sem rede, a faixa avisa de quando são os dados e as ações de gravar ficam desligadas', async () => {
  renderAt('/lancamentos')
  const pay = await screen.findByRole('button', { name: 'Marcar Mercado como pago' })
  expect(pay).toBeEnabled()
  expect(screen.queryByText(/Sem conexão/)).not.toBeInTheDocument()

  goOffline()

  expect(screen.getByText(/Sem conexão: mostrando dados de 16\/11 às 12:30/)).toBeInTheDocument()
  // Os dados carregados continuam na tela.
  expect(screen.getByRole('link', { name: /Mercado/ })).toBeInTheDocument()
  expect(pay).toBeDisabled()

  goOnline()

  expect(screen.queryByText(/Sem conexão/)).not.toBeInTheDocument()
  expect(pay).toBeEnabled()
})

test('sem rede, o formulário mostra o lançamento mas não deixa salvar nem excluir', async () => {
  renderAt('/lancamentos/a')
  expect(await screen.findByRole('button', { name: 'Salvar' })).toBeEnabled()

  goOffline()

  expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Excluir' })).toBeDisabled()
})

test('sem rede, o assistente avisa que precisa de conexão', async () => {
  goOffline()
  renderAt('/assistente')
  expect(await screen.findByText('O assistente precisa de conexão.')).toBeInTheDocument()
})

test('sair apaga os dados guardados no aparelho', async () => {
  store.set('minhas-financas:query-cache', { clientState: { queries: [{ queryKey: ['accounts'] }] } })
  const user = renderAt('/perfil')

  await user.click(await screen.findByRole('button', { name: 'Sair' }))

  await vi.waitFor(() => expect(store.size).toBe(0))
})

test('as configurações do assistente, que guardam a chave, não vão para o aparelho', () => {
  const queryClient = new QueryClient()
  queryClient.setQueryData(['accounts', 'user-1'], [])
  queryClient.setQueryData(['assistant_settings', 'user-1'], { openrouter_key: 'sk-or-segredo' })
  queryClient.setQueryData(['openrouter', 'models'], [])

  const saved = dehydrate(queryClient, persistOptions.dehydrateOptions)

  expect(saved.queries.map((query) => query.queryKey[0])).toEqual(['accounts'])
})
