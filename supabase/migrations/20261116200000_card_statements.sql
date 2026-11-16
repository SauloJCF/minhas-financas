-- Fase 2, fatia 3: fatura de cartão. A fatura não é uma tabela: é uma visão dos lançamentos
-- da conta cartão agrupados pelo ciclo de fechamento, calculado no app (ADR 0007). O banco
-- guarda só os dois dias do ciclo e sabe pagar uma fatura.

alter table public.accounts
  -- Dia do mês em que a fatura fecha e dia em que vence. Em meses mais curtos, o app usa o
  -- último dia do mês.
  add column closing_day smallint check (closing_day between 1 and 31),
  add column due_day smallint check (due_day between 1 and 31),
  add constraint accounts_card_days_together check ((closing_day is null) = (due_day is null)),
  add constraint accounts_card_days_only_on_cards check (type = 'cartao' or closing_day is null);

-- Mesma view, com os dois dias no fim (uma view só aceita colunas novas depois das antigas).
create or replace view public.accounts_with_balance
with (security_invoker = true) as
select
  a.id,
  a.user_id,
  a.name,
  a.type,
  a.initial_balance,
  a.initial_balance_date,
  a.color,
  a.icon,
  a.archived,
  a.created_at,
  (a.initial_balance + coalesce(t.paid, 0) + coalesce(f.net, 0))::bigint as current_balance,
  (a.initial_balance + coalesce(t.paid, 0) + coalesce(f.net, 0) + coalesce(t.pending, 0))::bigint as forecast_balance,
  a.closing_day,
  a.due_day
from public.accounts a
left join lateral (
  select
    sum(case when tr.type = 'income' then tr.amount else -tr.amount end)
      filter (where tr.paid_at >= a.initial_balance_date) as paid,
    sum(case when tr.type = 'income' then tr.amount else -tr.amount end)
      filter (where tr.paid_at is null) as pending
  from public.transactions tr
  where tr.account_id = a.id
) t on true
left join lateral (
  select sum(case when tf.to_account_id = a.id then tf.amount else -tf.amount end) as net
  from public.transfers tf
  where (tf.from_account_id = a.id or tf.to_account_id = a.id)
    and tf.date >= a.initial_balance_date
) f on true;

-- Paga a fatura de um cartão, tudo ou nada: marca como pagos, no próprio vencimento, os
-- lançamentos pendentes do período e transfere o total da fatura para o cartão. O período
-- vem do app, que conhece o ciclo. Roda com os direitos de quem chama: vale a RLS.
create function public.pay_card_statement(
  p_account_id uuid,
  p_from_account_id uuid,
  p_date date,
  p_period_start date,
  p_period_end date
)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_total bigint;
begin
  if not exists (select 1 from public.accounts where id = p_account_id and type = 'cartao') then
    raise exception 'cartão não encontrado' using errcode = 'P0002';
  end if;

  select coalesce(sum(case when type = 'expense' then amount else -amount end), 0) into v_total
  from public.transactions
  where account_id = p_account_id and due_date between p_period_start and p_period_end;

  if v_total <= 0 then
    raise exception 'fatura sem valor a pagar' using errcode = '22023';
  end if;

  update public.transactions set paid_at = due_date
  where account_id = p_account_id
    and due_date between p_period_start and p_period_end
    and paid_at is null;

  insert into public.transfers (from_account_id, to_account_id, amount, date, notes)
  values (p_from_account_id, p_account_id, v_total, p_date, 'Pagamento de fatura');

  return v_total;
end;
$$;

revoke all on function public.pay_card_statement(uuid, uuid, date, date, date) from public, anon;
grant execute on function public.pay_card_statement(uuid, uuid, date, date, date) to authenticated;
