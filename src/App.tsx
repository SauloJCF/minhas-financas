import { UpdatePrompt } from './components/UpdatePrompt'

export default function App() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-slate-50 p-6 text-center text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <img src="/favicon.svg" alt="" className="size-16" />
      <h1 className="text-2xl font-semibold">Minhas Finanças</h1>
      <p className="text-slate-600 dark:text-slate-400">
        O app está no ar. As funcionalidades chegam nas próximas versões.
      </p>
      <p className="text-xs text-slate-500">versão {__APP_VERSION__}</p>
      <UpdatePrompt />
    </main>
  )
}
