import { useRegisterSW } from 'virtual:pwa-register/react'

/** Avisa quando há uma versão nova do app e deixa o usuário decidir quando atualizar. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div
      role="alert"
      className="fixed inset-x-4 bottom-4 mx-auto flex max-w-md items-center justify-between gap-3 rounded-lg bg-slate-800 p-4 text-left text-sm text-white shadow-lg"
    >
      <span>Nova versão disponível.</span>
      <span className="flex gap-2">
        <button
          type="button"
          className="rounded px-3 py-1.5 text-slate-300 hover:bg-slate-700"
          onClick={() => setNeedRefresh(false)}
        >
          Depois
        </button>
        <button
          type="button"
          className="rounded bg-emerald-600 px-3 py-1.5 font-medium hover:bg-emerald-500"
          onClick={() => void updateServiceWorker(true)}
        >
          Atualizar
        </button>
      </span>
    </div>
  )
}
