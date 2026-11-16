-- Fatia 6: transferências entre contas do mesmo usuário. Uma linha por transferência (ADR 0003).

create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  from_account_id uuid not null,
  to_account_id uuid not null,
  -- Em centavos, sempre positivo: sai da origem e entra no destino.
  amount bigint not null check (amount > 0),
  -- Toda transferência já está efetivada nesta data; não há estado pendente.
  date date not null,
  notes text check (notes is null or char_length(notes) between 1 and 500),
  created_at timestamptz not null default now(),
  constraint transfers_different_accounts check (from_account_id <> to_account_id),
  -- O `user_id` na chave impede transferir de ou para a conta de outro usuário.
  -- Sem ON DELETE: conta com transferências não pode ser excluída, só arquivada.
  constraint transfers_from_account_fkey
    foreign key (from_account_id, user_id) references public.accounts (id, user_id),
  constraint transfers_to_account_fkey
    foreign key (to_account_id, user_id) references public.accounts (id, user_id)
);

create index transfers_user_id_date_idx on public.transfers (user_id, date);
create index transfers_from_account_id_idx on public.transfers (from_account_id);
create index transfers_to_account_id_idx on public.transfers (to_account_id);

alter table public.transfers enable row level security;

revoke all on public.transfers from anon;
grant select, insert, update, delete on public.transfers to authenticated;

create policy "transfers_select_own" on public.transfers
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "transfers_insert_own" on public.transfers
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "transfers_update_own" on public.transfers
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "transfers_delete_own" on public.transfers
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- O saldo de uma conta soma duas fontes: lançamentos pagos e transferências (saída na
-- origem, entrada no destino). Como nos pagamentos, o que tem data anterior à do saldo
-- inicial não conta, porque o saldo inicial já o inclui.
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
  (a.initial_balance + coalesce(t.paid, 0) + coalesce(f.net, 0) + coalesce(t.pending, 0))::bigint as forecast_balance
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

-- Extrato: lançamentos e transferências de cada conta em uma lista só. Uma transferência
-- aparece duas vezes, uma em cada conta. `amount` já vem com sinal; `date` é o pagamento do
-- lançamento ou, se pendente, o vencimento.
create view public.account_statement
with (security_invoker = true) as
select
  tr.id,
  tr.user_id,
  tr.account_id,
  'transaction'::text as kind,
  coalesce(tr.paid_at, tr.due_date) as date,
  tr.description,
  case when tr.type = 'income' then tr.amount else -tr.amount end as amount,
  -- Pendente ainda não mexeu no saldo.
  tr.paid_at is not null as settled,
  null::uuid as other_account_id,
  tr.created_at
from public.transactions tr
union all
select
  tf.id, tf.user_id, tf.from_account_id, 'transfer', tf.date, tf.notes, -tf.amount, true, tf.to_account_id, tf.created_at
from public.transfers tf
union all
select
  tf.id, tf.user_id, tf.to_account_id, 'transfer', tf.date, tf.notes, tf.amount, true, tf.from_account_id, tf.created_at
from public.transfers tf;

revoke all on public.account_statement from anon;
grant select on public.account_statement to authenticated;
