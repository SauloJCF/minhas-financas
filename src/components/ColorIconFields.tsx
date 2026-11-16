import type { UseFormRegisterReturn } from 'react-hook-form'
import { COLORS } from '@/lib/colors'
import { ICONS } from '@/lib/icons'

/** Escolha de cor, como botões de rádio em forma de bolinha. */
export function ColorField({ registration }: { registration: UseFormRegisterReturn }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">Cor</legend>
      <div className="flex flex-wrap gap-2">
        {COLORS.map((color) => (
          <label key={color.value} className="cursor-pointer">
            <input
              type="radio"
              value={color.value}
              aria-label={color.label}
              className="peer sr-only"
              {...registration}
            />
            <span
              className="block size-9 rounded-full ring-offset-2 ring-offset-background peer-checked:ring-2 peer-checked:ring-foreground peer-focus-visible:ring-3 peer-focus-visible:ring-ring"
              style={{ backgroundColor: color.value }}
            />
          </label>
        ))}
      </div>
    </fieldset>
  )
}

type IconFieldProps = {
  /** Chaves de `ICONS` oferecidas. */
  icons: string[]
  registration: UseFormRegisterReturn
}

/** Escolha de ícone, como botões de rádio. */
export function IconField({ icons, registration }: IconFieldProps) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">Ícone</legend>
      <div className="flex flex-wrap gap-2">
        {icons.map((key) => {
          const { label, Icon } = ICONS[key]
          return (
            <label key={key} className="cursor-pointer">
              <input type="radio" value={key} aria-label={label} className="peer sr-only" {...registration} />
              <span className="flex size-9 items-center justify-center rounded-lg border text-muted-foreground peer-checked:border-foreground peer-checked:bg-muted peer-checked:text-foreground peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50">
                <Icon className="size-5" />
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
