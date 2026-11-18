import { useSyncExternalStore } from 'react'
import { formatBRL, HIDDEN_MONEY } from '@/lib/money'

// "Valores ocultos": estado por aparelho. Guardado no próprio aparelho (nada vai ao servidor) e
// lido por um store externo, para qualquer tela reagir sem precisar de um provider.

const STORAGE_KEY = 'valores-ocultos'
const listeners = new Set<() => void>()

function read(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

let hidden = read()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Liga ou desliga os valores ocultos. */
export function setValuesHidden(value: boolean) {
  hidden = value
  try {
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
  } catch {
    // Sem armazenamento (modo privado, por exemplo): vale só até recarregar.
  }
  listeners.forEach((listener) => listener())
}

/** Os valores em reais estão ocultos neste aparelho? */
export function useValuesHidden(): boolean {
  return useSyncExternalStore(subscribe, () => hidden)
}

/**
 * Para valores dentro de uma frase: devolve o formatador que respeita os valores ocultos.
 * Use nas telas de consulta; onde o usuário age sobre o valor (formulários, confirmações),
 * use `formatBRL` direto.
 */
export function useFormatBRL(): (centavos: number) => string {
  const hidden = useValuesHidden()
  return hidden ? () => HIDDEN_MONEY : formatBRL
}
