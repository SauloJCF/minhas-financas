import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatBRL } from '@/lib/money'
import type { CategoryTotal } from './summary'

const ROW_HEIGHT = 32

/**
 * Despesas por categoria em barras horizontais, da maior para a menor. Uma série só, uma
 * cor só: quem identifica a categoria é o nome no eixo, não a cor. Os valores exatos ficam
 * na tabela ao lado do gráfico e na dica ao passar o mouse.
 *
 * Exportação padrão porque o gráfico é carregado sob demanda (o Recharts é pesado).
 */
export default function ExpensesChart({ data }: { data: CategoryTotal[] }) {
  return (
    <div aria-hidden style={{ height: data.length * ROW_HEIGHT }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }} barCategoryGap={8}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: 'var(--muted)' }}
            formatter={(value) => [formatBRL(Number(value)), 'Despesas']}
            contentStyle={{
              background: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--popover-foreground)',
              fontSize: 12,
            }}
            itemStyle={{ color: 'var(--popover-foreground)' }}
          />
          <Bar dataKey="amount" fill="var(--chart-1)" radius={[0, 4, 4, 0]} barSize={14} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
