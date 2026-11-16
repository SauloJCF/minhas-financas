import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

type Props = {
  title: string
  /** A lista de onde a pessoa veio, para o link de voltar. */
  back: { to: string; label: string }
  children: ReactNode
}

/** Moldura das telas de criar e editar: link de volta, título e uma coluna estreita. */
export function FormPage({ title, back, children }: Props) {
  return (
    <div className="mx-auto grid max-w-md gap-6">
      <div className="grid gap-2">
        <Link to={back.to} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft aria-hidden className="size-4" />
          {back.label}
        </Link>
        <h1 className="text-xl font-semibold">{title}</h1>
      </div>
      {children}
    </div>
  )
}

/** Estados de uma tela de edição enquanto o item não está disponível. */
export function LoadingMessage() {
  return (
    <p role="status" className="text-muted-foreground">
      Carregando…
    </p>
  )
}

export function ErrorMessage({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-sm text-destructive">
      {children}
    </p>
  )
}
