import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type Props = {
  title: string
  description?: string
  children: ReactNode
}

/** Moldura das telas fora do app (login, senha): logo e um cartão centralizado. */
export function AuthLayout({ title, description, children }: Props) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-muted p-4">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <img src="/favicon.svg" alt="" className="size-8" />
        Minhas Finanças
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            <h1>{title}</h1>
          </CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent className="grid gap-4">{children}</CardContent>
      </Card>
    </main>
  )
}
