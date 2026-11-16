import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { IconBadge } from '@/components/IconBadge'

type Props = {
  to: string
  color: string
  icon: string
  name: string
  /** Apagado na lista: o item está arquivado. */
  dimmed?: boolean
  /** O que vai à direita do nome, como um saldo. */
  children?: ReactNode
}

/** Linha de uma lista de contas ou categorias: leva à tela de edição do item. */
export function ListRow({ to, color, icon, name, dimmed, children }: Props) {
  return (
    <li>
      <Link to={to} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted">
        <IconBadge color={color} icon={icon} className={dimmed ? 'opacity-50' : ''} />
        <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
        {children}
        <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
      </Link>
    </li>
  )
}
