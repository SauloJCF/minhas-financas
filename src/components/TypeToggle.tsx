import type { UseFormRegisterReturn } from 'react-hook-form'

const OPTIONS = [
  { value: 'expense', label: 'Despesa' },
  { value: 'income', label: 'Receita' },
]

/** Escolha entre despesa e receita, como dois botões lado a lado. */
export function TypeToggle({ legend, registration }: { legend: string; registration: UseFormRegisterReturn }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        {OPTIONS.map((option) => (
          <label key={option.value} className="cursor-pointer">
            <input type="radio" value={option.value} className="peer sr-only" {...registration} />
            <span className="block rounded-md py-1.5 text-center text-sm text-muted-foreground peer-checked:bg-background peer-checked:font-medium peer-checked:text-foreground peer-checked:shadow-sm peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50">
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
