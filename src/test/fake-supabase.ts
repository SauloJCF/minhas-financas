// Supabase falso para os testes de tela: tabelas em memória e o mínimo da API de consultas.
// Uso: `vi.mock('@/lib/supabase', () => import('@/test/fake-supabase'))` e, no teste, `db`.
import { vi } from 'vitest'

type Row = Record<string, unknown>
type Result = { data: unknown; error: unknown }
type Filter = (row: Row) => boolean

export const db = {
  tables: {} as Record<string, Row[]>,
  /** Views: funções que derivam linhas das tabelas. */
  views: {} as Record<string, () => Row[]>,
  /** Erro devolvido pela próxima operação, por chave "operação:tabela" (ex.: "delete:accounts"). */
  errors: {} as Record<string, { code: string } | undefined>,
  session: { user: { id: 'ana', email: 'ana@example.com' } } as { user: { id: string; email: string } } | null,
  nextId: 1,

  reset() {
    db.tables = { accounts: [], categories: [], transactions: [], transfers: [], transaction_series: [] }
    db.views = {
      // A mesma regra da view do banco: pagos (a partir da data do saldo inicial) no saldo
      // atual; pendentes só no previsto.
      accounts_with_balance: () =>
        db.tables.accounts.map((account) => {
          const signed = (row: Row) => (row.type === 'income' ? 1 : -1) * (row.amount as number)
          const own = db.tables.transactions.filter((row) => row.account_id === account.id)
          const sum = (rows: Row[]) => rows.reduce((total, row) => total + signed(row), 0)
          const since = account.initial_balance_date as string
          const transfers = db.tables.transfers
            .filter((row) => (row.date as string) >= since)
            .reduce(
              (total, row) =>
                total +
                (row.to_account_id === account.id ? (row.amount as number) : 0) -
                (row.from_account_id === account.id ? (row.amount as number) : 0),
              0,
            )
          const current =
            (account.initial_balance as number) +
            sum(own.filter((row) => row.paid_at && (row.paid_at as string) >= since)) +
            transfers
          return {
            ...account,
            current_balance: current,
            forecast_balance: current + sum(own.filter((row) => !row.paid_at)),
          }
        }),
      // Como no banco: cada lançamento uma vez, cada transferência uma vez por conta.
      account_statement: () => [
        ...db.tables.transactions.map((row) => ({
          id: row.id,
          account_id: row.account_id,
          kind: 'transaction',
          date: row.paid_at ?? row.due_date,
          description: row.description,
          amount: (row.type === 'income' ? 1 : -1) * (row.amount as number),
          settled: Boolean(row.paid_at),
          other_account_id: null,
          created_at: row.created_at,
        })),
        ...db.tables.transfers.flatMap((row) => [
          {
            id: row.id,
            account_id: row.from_account_id,
            kind: 'transfer',
            date: row.date,
            description: row.notes,
            amount: -(row.amount as number),
            settled: true,
            other_account_id: row.to_account_id,
            created_at: row.created_at,
          },
          {
            id: row.id,
            account_id: row.to_account_id,
            kind: 'transfer',
            date: row.date,
            description: row.notes,
            amount: row.amount,
            settled: true,
            other_account_id: row.from_account_id,
            created_at: row.created_at,
          },
        ]),
      ],
    }
    db.errors = {}
    db.session = { user: { id: 'ana', email: 'ana@example.com' } }
    db.nextId = 1
  },
}
db.reset()

function compare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a ?? '').localeCompare(String(b ?? ''))
}

function from(table: string) {
  const filters: Filter[] = []
  const orders: { column: string; ascending: boolean }[] = []
  let operation: 'select' | 'insert' | 'update' | 'delete' = 'select'
  let payload: Row | Row[] = {}
  const matches = (row: Row) => filters.every((filter) => filter(row))

  function run(): Result {
    const error = db.errors[`${operation}:${table}`]
    if (error) return { data: null, error }

    if (operation === 'select') {
      const source = db.views[table]?.() ?? db.tables[table]
      if (!source) throw new Error(`tabela inesperada: ${table}`)
      const rows = source.filter(matches).map((row) => ({ ...row }))
      for (const { column, ascending } of [...orders].reverse()) {
        rows.sort((a, b) => compare(a[column], b[column]) * (ascending ? 1 : -1))
      }
      return { data: rows, error: null }
    }

    const rows = db.tables[table]
    if (!rows) throw new Error(`tabela inesperada: ${table}`)
    if (operation === 'insert') {
      for (const values of Array.isArray(payload) ? payload : [payload]) {
        const id = db.nextId++
        rows.push({ id: `${table}-${id}`, created_at: String(id).padStart(6, '0'), archived: false, ...values })
      }
    } else if (operation === 'update') {
      rows.filter(matches).forEach((row) => Object.assign(row, payload))
    } else {
      db.tables[table] = rows.filter((row) => !matches(row))
    }
    return { data: null, error: null }
  }

  const builder = {
    select: () => builder,
    order(column: string, options?: { ascending?: boolean }) {
      orders.push({ column, ascending: options?.ascending ?? true })
      return builder
    },
    insert(values: Row | Row[]) {
      operation = 'insert'
      payload = values
      return builder
    },
    update(values: Row) {
      operation = 'update'
      payload = values
      return builder
    },
    delete() {
      operation = 'delete'
      return builder
    },
    eq(column: string, value: unknown) {
      filters.push((row) => row[column] === value)
      return builder
    },
    gte(column: string, value: string | number) {
      filters.push((row) => (row[column] as string | number) >= value)
      return builder
    },
    gt(column: string, value: string | number) {
      filters.push((row) => (row[column] as string | number) > value)
      return builder
    },
    is(column: string, value: null) {
      filters.push((row) => (row[column] ?? null) === value)
      return builder
    },
    lte(column: string, value: string | number) {
      filters.push((row) => (row[column] as string | number) <= value)
      return builder
    },
    then(resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) {
      return Promise.resolve()
        .then(run)
        .then(resolve, reject)
    },
  }
  return builder
}

/** O mesmo cálculo de `series_due_date` no banco: o dia que não existe cai no último do mês. */
function seriesDueDate(start: string, frequency: string, occurrence: number): string {
  const [year, month, day] = start.split('-').map(Number)
  const steps = occurrence - 1
  const iso = (date: Date) => date.toISOString().slice(0, 10)
  if (frequency === 'weekly') return iso(new Date(Date.UTC(year, month - 1, day + steps * 7)))
  const months = month - 1 + (frequency === 'yearly' ? steps * 12 : steps)
  const lastDay = new Date(Date.UTC(year, months + 1, 0)).getUTCDate()
  return iso(new Date(Date.UTC(year, months, Math.min(day, lastDay))))
}

function insertRow(table: string, values: Row) {
  const id = db.nextId++
  db.tables[table].push({ id: `${table}-${id}`, created_at: String(id).padStart(6, '0'), ...values })
  return `${table}-${id}`
}

/** As funções do banco chamadas pelo app, refeitas em memória. */
const functions: Record<string, (args: Record<string, unknown>) => unknown> = {
  create_recurrence(args) {
    const start = args.p_due_date as string
    const seriesId = insertRow('transaction_series', {
      kind: 'recurrence',
      frequency: args.p_frequency,
      start_date: start,
      installment_count: null,
    })
    for (let n = 1; n <= 12; n++) {
      insertRow('transactions', {
        type: args.p_type,
        description: args.p_description,
        amount: args.p_amount,
        account_id: args.p_account_id,
        category_id: args.p_category_id,
        due_date: seriesDueDate(start, args.p_frequency as string, n),
        paid_at: n === 1 ? args.p_paid_at : null,
        notes: args.p_notes,
        group_id: seriesId,
        installment_number: n,
      })
    }
    return seriesId
  },
  extend_recurrence(args) {
    const series = db.tables.transaction_series.find((row) => row.id === args.p_series_id)!
    const occurrences = db.tables.transactions.filter((row) => row.group_id === series.id)
    const last = occurrences.reduce((a, b) => ((a.installment_number as number) > (b.installment_number as number) ? a : b))
    for (let n = 1; n <= 12; n++) {
      const number = (last.installment_number as number) + n
      const { id: _id, created_at: _createdAt, ...copy } = last
      insertRow('transactions', {
        ...copy,
        due_date: seriesDueDate(series.start_date as string, series.frequency as string, number),
        paid_at: null,
        installment_number: number,
      })
    }
    return null
  },
}

async function rpc(name: string, args: Record<string, unknown>): Promise<Result> {
  const error = db.errors[`rpc:${name}`]
  if (error) return { data: null, error }
  return { data: functions[name](args), error: null }
}

const auth = {
  onAuthStateChange: vi.fn((callback: (event: string, session: unknown) => void) => {
    queueMicrotask(() => callback('INITIAL_SESSION', db.session))
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  }),
  updateUser: vi.fn(async () => ({ error: null })),
  signOut: vi.fn(async () => ({ error: null })),
}

export const supabase = { auth, from, rpc }
