/** Bolinha que avisa que há ticket aguardando resposta do usuário. */
export function WaitingDot() {
  return (
    <>
      <span aria-hidden className="size-2 shrink-0 rounded-full bg-primary" />
      <span className="sr-only">Há tickets aguardando você</span>
    </>
  )
}
