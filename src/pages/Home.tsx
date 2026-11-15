export function Home() {
  return (
    <div className="grid gap-2 py-8 text-center">
      <h1 className="text-xl font-semibold">Tudo pronto</h1>
      <p className="text-muted-foreground">
        Você está logado. Contas, lançamentos e o painel chegam nas próximas versões.
      </p>
      <p className="text-xs text-muted-foreground">versão {__APP_VERSION__}</p>
    </div>
  )
}
