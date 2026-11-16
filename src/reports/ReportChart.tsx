import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatBRL } from '@/lib/money'

/** Uma série do gráfico: a chave do valor em cada linha, o nome e a cor. */
export type ChartSeries = { key: string; name: string; color: string }

type Props = {
  /** Uma linha por mês; `label` vai no eixo e cada série lê o valor pela sua chave. */
  data: Record<string, number | string>[]
  series: ChartSeries[]
  /** Empilha as séries em uma barra por mês; sem isso, ficam lado a lado. */
  stacked?: boolean
}

const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })

/**
 * Barras por mês, lado a lado ou empilhadas. As cores só identificam as séries: os nomes
 * ficam na legenda e os valores exatos na tabela, que acompanham o gráfico na tela.
 *
 * Exportação padrão porque o gráfico é carregado sob demanda (o Recharts é pesado).
 */
export default function ReportChart({ data, series, stacked = false }: Props) {
  return (
    <div aria-hidden className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barCategoryGap="24%" barGap={2}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <YAxis
            width={44}
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            tickFormatter={(value) => compact.format(Number(value) / 100)}
          />
          <Tooltip
            cursor={{ fill: 'var(--muted)' }}
            formatter={(value, name) => [formatBRL(Number(value)), name]}
            contentStyle={{
              background: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--popover-foreground)',
              fontSize: 12,
            }}
            itemStyle={{ color: 'var(--popover-foreground)' }}
            labelStyle={{ color: 'var(--muted-foreground)' }}
          />
          {series.map((item, index) => (
            <Bar
              key={item.key}
              dataKey={item.key}
              name={item.name}
              fill={item.color}
              stackId={stacked ? 'stack' : undefined}
              // Empilhadas: um fio da cor do fundo separa os segmentos, e só o topo é arredondado.
              stroke={stacked ? 'var(--background)' : undefined}
              strokeWidth={stacked ? 2 : 0}
              radius={!stacked || index === series.length - 1 ? [4, 4, 0, 0] : 0}
              maxBarSize={stacked ? 28 : 14}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
