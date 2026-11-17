import { defaultShouldDehydrateQuery, onlineManager, QueryClient, useQueryClient } from '@tanstack/react-query'
import type { PersistedClient, Persister, PersistQueryClientOptions } from '@tanstack/react-query-persist-client'
import { del, get, set } from 'idb-keyval'
import { useSyncExternalStore } from 'react'

/** Por quanto tempo uma consulta guardada no aparelho ainda vale ser mostrada. */
const MAX_AGE = 7 * 24 * 60 * 60 * 1000

/** Onde o cache fica no IndexedDB. */
const STORAGE_KEY = 'minhas-financas:query-cache'

/**
 * Consultas que nunca vão para o aparelho: as configurações do assistente guardam a chave do
 * OpenRouter, e a lista de modelos não é dado do usuário.
 */
const NOT_PERSISTED = new Set(['assistant_settings', 'openrouter'])

/**
 * O TanStack Query começa achando que está online e só muda num evento `offline`. Quem abre o
 * app já sem rede precisa ver o estado certo desde o início, então ele parte do `navigator.onLine`.
 */
onlineManager.setEventListener((setOnline) => {
  const update = () => setOnline(navigator.onLine)
  update()
  window.addEventListener('online', update)
  window.addEventListener('offline', update)
  return () => {
    window.removeEventListener('online', update)
    window.removeEventListener('offline', update)
  }
})

export function createQueryClient() {
  // O cache precisa durar em memória pelo menos o tempo que dura no aparelho; senão uma
  // consulta sai da memória (e do que é salvo) antes de valer a pena mostrá-la offline.
  return new QueryClient({ defaultOptions: { queries: { gcTime: MAX_AGE } } })
}

/**
 * Grava o cache no IndexedDB. O TanStack Query pede para salvar a cada mudança no cache;
 * aqui as gravações se juntam em no máximo uma por segundo.
 */
function createIdbPersister(): Persister {
  let pending: PersistedClient | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  return {
    persistClient: (client) => {
      pending = client
      timer ??= setTimeout(() => {
        timer = undefined
        void set(STORAGE_KEY, pending)
      }, 1000)
    },
    restoreClient: () => get<PersistedClient>(STORAGE_KEY),
    removeClient: async () => {
      clearTimeout(timer)
      timer = undefined
      pending = undefined
      await del(STORAGE_KEY)
    },
  }
}

const persister = createIdbPersister()

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister,
  maxAge: MAX_AGE,
  // Cada versão publicada descarta o cache da anterior, que pode ter outro formato.
  buster: __APP_VERSION__,
  dehydrateOptions: {
    shouldDehydrateQuery: (query) =>
      defaultShouldDehydrateQuery(query) && !NOT_PERSISTED.has(String(query.queryKey[0])),
  },
}

/** Apaga os dados do usuário da memória e do aparelho. Usado ao sair da conta. */
export async function clearUserCache(queryClient: QueryClient) {
  queryClient.clear()
  await persister.removeClient()
}

/** Se o aparelho tem rede. Sem rede, o app só mostra o que já tinha carregado. */
export function useOnline() {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
  )
}

/** Quando os dados mostrados foram carregados do servidor pela última vez; `0` se nunca. */
export function useLastUpdatedAt() {
  const queryCache = useQueryClient().getQueryCache()
  return useSyncExternalStore(
    (onChange) => queryCache.subscribe(onChange),
    () => Math.max(0, ...queryCache.getAll().map((query) => query.state.dataUpdatedAt)),
  )
}
