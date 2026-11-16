import { House, Receipt, Tags, User, Wallet, type LucideIcon } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router'
import { cn } from 'cn'

type NavItem = {
  label: string
  Icon: LucideIcon
  /** Sem rota, a tela ainda não existe: o item aparece desligado, guardando o lugar. */
  to?: string
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Início', Icon: House, to: '/' },
  { label: 'Lançamentos', Icon: Receipt },
  { label: 'Contas', Icon: Wallet, to: '/contas' },
  { label: 'Categorias', Icon: Tags },
  { label: 'Perfil', Icon: User, to: '/perfil' },
]

// No celular os itens são colunas (ícone sobre o rótulo); no desktop, linhas do menu lateral.
const itemClass =
  'flex flex-1 flex-col items-center gap-1 px-1 py-2 text-xs md:flex-none md:flex-row md:gap-3 md:rounded-lg md:px-3 md:text-sm'

function Brand({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('items-center gap-2 font-semibold', className)}>
      <img src="/favicon.svg" alt="" className="size-6" />
      Minhas Finanças
    </Link>
  )
}

/**
 * Moldura das telas do app para quem está logado. A navegação é uma só: barra fixa embaixo
 * no celular, menu lateral a partir de `md`.
 */
export function AppLayout() {
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <header className="border-b px-4 py-3 md:hidden">
        <Brand className="flex" />
      </header>

      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-10 flex border-t bg-background pb-[env(safe-area-inset-bottom)] md:sticky md:inset-x-auto md:top-0 md:h-dvh md:w-56 md:shrink-0 md:flex-col md:gap-1 md:border-t-0 md:border-r md:p-4"
      >
        <Brand className="mb-5 hidden px-3 md:flex" />
        {NAV_ITEMS.map(({ label, Icon, to }) =>
          to ? (
            <NavLink
              key={label}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  itemClass,
                  isActive
                    ? 'font-medium text-primary md:bg-muted'
                    : 'text-muted-foreground hover:text-foreground',
                )
              }
            >
              <Icon aria-hidden className="size-5" />
              {label}
            </NavLink>
          ) : (
            <span
              key={label}
              aria-disabled
              title="Em breve"
              className={cn(itemClass, 'text-muted-foreground/40')}
            >
              <Icon aria-hidden className="size-5" />
              {label}
            </span>
          ),
        )}
      </nav>

      {/* pb-20: no celular, o fim do conteúdo não fica atrás da navegação fixa. */}
      <main className="mx-auto w-full max-w-3xl flex-1 p-4 pb-20 md:p-8">
        <Outlet />
      </main>
    </div>
  )
}
