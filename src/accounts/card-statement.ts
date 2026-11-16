import { useQuery } from '@tanstack/react-query'
import { addDays, addMonths, dayInMonth } from '@/lib/dates'
import { useDbMutation, useUserQueryKey } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { signedAmount, type Transaction } from '@/transactions/api'

// A fatura não existe no banco: é o conjunto dos lançamentos da conta cartão cujo vencimento
// cai em um ciclo de fechamento (ADR 0007). Este módulo calcula o ciclo.

/** O ciclo de uma fatura. Todas as datas são "2026-11-10". */
export type CardStatementPeriod = {
  /** Primeiro e último dia de compras que entram na fatura. */
  start: string
  end: string
  /** Dia em que a fatura fecha: compras deste dia já são da fatura seguinte. */
  closingDate: string
  dueDate: string
}

/**
 * O ciclo da fatura que fecha no mês dado ("2026-11"). Vai do fechamento do mês anterior até
 * a véspera do fechamento deste. O vencimento é no mesmo mês quando o dia de vencimento vem
 * depois do de fechamento; senão, no mês seguinte.
 */
export function cardStatementPeriod(month: string, closingDay: number, dueDay: number): CardStatementPeriod {
  const closingDate = dayInMonth(month, closingDay)
  return {
    start: dayInMonth(addMonths(month, -1), closingDay),
    end: addDays(closingDate, -1),
    closingDate,
    dueDate: dayInMonth(dueDay > closingDay ? month : addMonths(month, 1), dueDay),
  }
}

/** O mês da fatura aberta em uma data: a que ainda recebe as compras desse dia. */
export function openStatementMonth(date: string, closingDay: number): string {
  const month = date.slice(0, 7)
  return date >= dayInMonth(month, closingDay) ? addMonths(month, 1) : month
}

/** O total de uma fatura: despesas menos o que entrou no cartão (estornos), em centavos. */
export function statementTotal(transactions: Pick<Transaction, 'type' | 'amount'>[]): number {
  return transactions.reduce((total, transaction) => total - signedAmount(transaction), 0)
}

/** Os lançamentos de uma conta cartão com vencimento no ciclo, em ordem de data. */
export function useCardStatement(accountId: string, period: CardStatementPeriod | null) {
  return useQuery({
    queryKey: useUserQueryKey('transactions', 'card-statement', accountId, period?.start, period?.end),
    enabled: period !== null,
    queryFn: async (): Promise<Transaction[]> => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('account_id', accountId)
        .gte('due_date', period!.start)
        .lte('due_date', period!.end)
        .order('due_date')
        .order('created_at')
      if (error) throw error
      return data
    },
  })
}

type PayVariables = {
  accountId: string
  fromAccountId: string
  /** Data em que o dinheiro sai da conta de origem. */
  date: string
  period: CardStatementPeriod
}

/**
 * Paga a fatura: marca como pagos os lançamentos pendentes do ciclo e transfere o total da
 * conta de origem para o cartão, tudo ou nada.
 */
export function usePayCardStatement() {
  return useDbMutation(
    ['transactions', 'transfers', 'accounts', 'statement'],
    async ({ accountId, fromAccountId, date, period }: PayVariables) => {
      const { error } = await supabase.rpc('pay_card_statement', {
        p_account_id: accountId,
        p_from_account_id: fromAccountId,
        p_date: date,
        p_period_start: period.start,
        p_period_end: period.end,
      })
      if (error) throw error
    },
  )
}
