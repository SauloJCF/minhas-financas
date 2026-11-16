import { useId, type ComponentProps } from 'react'
import { Label } from '@/components/ui/label'

type Props = ComponentProps<'select'> & {
  label: string
  error?: string
}

/** Lista de opções nativa (no celular abre o seletor do sistema), com rótulo e erro. */
export function SelectField({ label, error, children, ...selectProps }: Props) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30"
        {...selectProps}
      >
        {children}
      </select>
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
