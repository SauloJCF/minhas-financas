import { WifiOff } from 'lucide-react'
import { useLastUpdatedAt, useOnline } from '@/lib/offline'

const dateTime = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

/** Faixa que avisa, sem rede, que os dados podem estar desatualizados e que gravar não funciona. */
export function OfflineBanner() {
  const online = useOnline()
  const lastUpdatedAt = useLastUpdatedAt()
  if (online) return null

  const [date, time] = lastUpdatedAt ? dateTime.format(lastUpdatedAt).split(', ') : []
  return (
    <div role="status" className="flex items-start gap-2 bg-muted px-4 py-2 text-sm">
      <WifiOff aria-hidden className="mt-0.5 size-4 shrink-0" />
      <p>
        {date ? `Sem conexão: mostrando dados de ${date} às ${time}.` : 'Sem conexão.'} Salvar e excluir voltam a
        funcionar quando a conexão voltar.
      </p>
    </div>
  )
}
