import { Link, Outlet } from 'react-router'

/** Moldura das telas do app para quem está logado. */
export function AppLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <img src="/favicon.svg" alt="" className="size-6" />
          Minhas Finanças
        </Link>
        <Link to="/conta" className="text-sm text-muted-foreground hover:text-foreground">
          Conta
        </Link>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 p-4">
        <Outlet />
      </main>
    </div>
  )
}
