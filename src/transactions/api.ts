import { useQuery } from '@tanstack/react-query'
import type { Enums, Tables, TablesInsert } from '@/lib/database.types'
import { monthRange } from '@/lib/dates'
import { useDbMutation, useUserQueryKey } from '@/lib/db'
import { supabase } from '@/lib/supabase'

/** Um lançamento: receita (`income`) ou despesa (`expense`). */
export type Transaction = Tables<'transactions'>

export type TransactionInput = Pick<
  TablesInsert<'transactions'>,
  'type' | 'description' | 'amount' | 'account_id' | 'category_id' | 'due_date' | 'paid_at' | 'notes'
>

/** De quanto em quanto tempo uma recorrência se repete. */
export type Frequency = Enums<'series_frequency'>

/** Alcance de uma alteração ou exclusão em um lançamento de série. */
export type SeriesScope = 'one' | 'following'

/** Uma série e o tamanho que ela tem hoje. */
export type SeriesInfo = Tables<'transaction_series'> & {
  /** Posição e vencimento da última ocorrência existente. */
  lastNumber: number
  lastDueDate: string
}

/** Uma série como está no banco: recorrência ou parcelamento. */
export type Series = Tables<'transaction_series'>

/** "(3/10)" para uma parcela; vazio para qualquer outro lançamento. */
export function installmentLabel(
  transaction: Pick<Transaction, 'installment_number'>,
  series: Pick<Series, 'kind' | 'installment_count'> | null | undefined,
): string {
  if (series?.kind !== 'installment') return ''
  return `(${transaction.installment_number}/${series.installment_count})`
}

/** Divide um total em parcelas: os centavos que sobram vão na primeira. */
export function splitInstallments(total: number, count: number): { first: number; others: number } {
  const others = Math.floor(total / count)
  return { first: total - others * (count - 1), others }
}

/** Pago, pendente ou vencido (pendente cujo vencimento já passou). */
export type TransactionStatus = 'paid' | 'pending' | 'overdue'

/**
 * `inCard` diz que o lançamento é de uma conta cartão: pendente em cartão nunca é vencido,
 * porque quem o cobra é a fatura.
 */
export function statusOf(
  transaction: Pick<Transaction, 'paid_at' | 'due_date'>,
  today: string,
  inCard = false,
): TransactionStatus {
  if (transaction.paid_at) return 'paid'
  return !inCard && transaction.due_date < today ? 'overdue' : 'pending'
}

/** O valor com o sinal do tipo: receita soma, despesa subtrai. */
export function signedAmount(transaction: Pick<Transaction, 'type' | 'amount'>): number {
  return transaction.type === 'income' ? transaction.amount : -transaction.amount
}

// Gravar um lançamento muda também os saldos e o extrato das contas.
const INVALIDATES = ['transactions', 'accounts', 'statement']

/** Os lançamentos com vencimento no mês ("2026-11"), em ordem de vencimento. */
export function useTransactions(month: string) {
  return useQuery({
    queryKey: useUserQueryKey('transactions', 'month', month),
    queryFn: async (): Promise<Transaction[]> => {
      const { first, last } = monthRange(month)
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .gte('due_date', first)
        .lte('due_date', last)
        .order('due_date')
        .order('created_at')
      if (error) throw error
      return data
    },
  })
}

/** Um lançamento pelo id; `null` se não existe ou é de outro usuário. */
export function useTransaction(id: string | undefined) {
  return useQuery({
    queryKey: useUserQueryKey('transactions', 'one', id),
    enabled: Boolean(id),
    queryFn: async (): Promise<Transaction | null> => {
      const { data, error } = await supabase.from('transactions').select('*').eq('id', id!)
      if (error) throw error
      return data[0] ?? null
    },
  })
}

/** Todas as séries do usuário, por id: a lista de lançamentos as usa para rotular cada linha. */
export function useSeriesMap() {
  return useQuery({
    queryKey: useUserQueryKey('transactions', 'series', 'all'),
    queryFn: async (): Promise<Map<string, Series>> => {
      const { data, error } = await supabase.from('transaction_series').select('*')
      if (error) throw error
      return new Map(data.map((series) => [series.id, series]))
    },
  })
}

/** A série de um lançamento; `null` se ele não faz parte de uma. */
export function useSeries(groupId: string | null | undefined) {
  return useQuery({
    queryKey: useUserQueryKey('transactions', 'series', groupId),
    enabled: Boolean(groupId),
    queryFn: async (): Promise<SeriesInfo | null> => {
      const series = await supabase.from('transaction_series').select('*').eq('id', groupId!)
      if (series.error) throw series.error
      const occurrences = await supabase
        .from('transactions')
        .select('installment_number, due_date')
        .eq('group_id', groupId!)
        .order('installment_number', { ascending: false })
      if (occurrences.error) throw occurrences.error
      const last = occurrences.data[0]
      if (!series.data[0] || !last) return null
      return { ...series.data[0], lastNumber: last.installment_number!, lastDueDate: last.due_date }
    },
  })
}

type SaveVariables = {
  id?: string
  values: TransactionInput
  /** Ao criar: repete o lançamento nesta frequência. */
  frequency?: Frequency | null
  /** Ao criar: divide o valor, que é o total, neste número de parcelas mensais. */
  installments?: number | null
  /** Ao alterar um lançamento de série: `following` leva a mudança aos próximos pendentes. */
  following?: Pick<Transaction, 'group_id' | 'installment_number'>
}

/**
 * Cria o lançamento ou, com `id`, altera o que já existe. Com `frequency`, cria uma
 * recorrência; com `installments`, um parcelamento. Com `following`, a alteração vale também para as ocorrências pendentes
 * seguintes da série, menos o vencimento e o pagamento, que são de cada uma.
 */
export function useSaveTransaction() {
  return useDbMutation(INVALIDATES, async ({ id, values, frequency, installments, following }: SaveVariables) => {
    if (!id && (frequency || installments)) {
      const shared = {
        p_type: values.type,
        p_description: values.description,
        p_amount: values.amount,
        p_account_id: values.account_id,
        p_category_id: values.category_id,
        p_due_date: values.due_date,
        // Os tipos gerados não sabem que estes dois argumentos aceitam nulo.
        p_paid_at: values.paid_at as string,
        p_notes: values.notes as string,
      }
      const { error } = installments
        ? await supabase.rpc('create_installments', { ...shared, p_count: installments })
        : await supabase.rpc('create_recurrence', { ...shared, p_frequency: frequency! })
      if (error) throw error
      return
    }
    const { error } = id
      ? await supabase.from('transactions').update(values).eq('id', id)
      : await supabase.from('transactions').insert(values)
    if (error) throw error
    if (id && following?.group_id) {
      const { due_date: _dueDate, paid_at: _paidAt, ...shared } = values
      const { error: followingError } = await supabase
        .from('transactions')
        .update(shared)
        .eq('group_id', following.group_id)
        .gt('installment_number', following.installment_number!)
        .is('paid_at', null)
      if (followingError) throw followingError
    }
  })
}

/** Gera mais 12 ocorrências de uma recorrência, a partir da última. */
export function useExtendRecurrence() {
  return useDbMutation(INVALIDATES, async (seriesId: string) => {
    const { error } = await supabase.rpc('extend_recurrence', { p_series_id: seriesId })
    if (error) throw error
  })
}

/** Marca como pago na data dada, ou desfaz o pagamento com `null`. */
export function useSetPaid() {
  return useDbMutation(INVALIDATES, async ({ id, paidAt }: { id: string; paidAt: string | null }) => {
    const { error } = await supabase.from('transactions').update({ paid_at: paidAt }).eq('id', id)
    if (error) throw error
  })
}

type DeleteVariables = {
  id: string
  /** Em um lançamento de série: exclui também as ocorrências pendentes seguintes. */
  following?: Pick<Transaction, 'group_id' | 'installment_number'>
}

/** Exclui de verdade: lançamentos não têm lixeira. */
export function useDeleteTransaction() {
  return useDbMutation(INVALIDATES, async ({ id, following }: DeleteVariables) => {
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) throw error
    if (following?.group_id) {
      const { error: followingError } = await supabase
        .from('transactions')
        .delete()
        .eq('group_id', following.group_id)
        .gt('installment_number', following.installment_number!)
        .is('paid_at', null)
      if (followingError) throw followingError
    }
  })
}
