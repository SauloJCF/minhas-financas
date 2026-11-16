-- Fatia 5: lançamentos (receitas e despesas), com controle de pagamento.

-- Alvos das chaves estrangeiras compostas dos lançamentos. Como o RLS não vale para a
-- checagem de chave estrangeira, é o `user_id` na chave que impede usar conta ou categoria
-- de outro usuário; e é o `type` que garante categoria do mesmo tipo do lançamento.
alter table public.accounts add constraint accounts_id_user_id_key unique (id, user_id);
alter table public.categories drop constraint categories_id_type_key;
alter table public.categories add constraint categories_id_user_id_type_key unique (id, user_id, type);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type public.transaction_type not null,
  description text not null check (description = btrim(description) and char_length(description) between 1 and 100),
  -- Em centavos, sempre positivo: o sinal vem do tipo.
  amount bigint not null check (amount > 0),
  account_id uuid not null,
  category_id uuid not null,
  -- Vencimento.
  due_date date not null,
  -- Pagamento; nulo = pendente. Só lançamentos pagos alteram o saldo atual.
  paid_at date,
  notes text check (notes is null or char_length(notes) between 1 and 500),
  created_at timestamptz not null default now(),
  -- Sem ON DELETE: conta ou categoria em uso não pode ser excluída, só arquivada.
  constraint transactions_account_fkey
    foreign key (account_id, user_id) references public.accounts (id, user_id),
  constraint transactions_category_fkey
    foreign key (category_id, user_id, type) references public.categories (id, user_id, type)
);

create index transactions_user_id_due_date_idx on public.transactions (user_id, due_date);
create index transactions_account_id_idx on public.transactions (account_id);
create index transactions_category_id_idx on public.transactions (category_id);

alter table public.transactions enable row level security;

revoke all on public.transactions from anon;
grant select, insert, update, delete on public.transactions to authenticated;

create policy "transactions_select_own" on public.transactions
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "transactions_insert_own" on public.transactions
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "transactions_update_own" on public.transactions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "transactions_delete_own" on public.transactions
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Saldo atual: saldo inicial mais os lançamentos pagos. Um pagamento anterior à data do saldo
-- inicial não conta, porque o saldo inicial já o inclui.
-- Saldo previsto: o saldo atual mais todos os lançamentos pendentes.
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
  (a.initial_balance + coalesce(t.paid, 0))::bigint as current_balance,
  (a.initial_balance + coalesce(t.paid, 0) + coalesce(t.pending, 0))::bigint as forecast_balance
from public.accounts a
left join lateral (
  select
    sum(case when tr.type = 'income' then tr.amount else -tr.amount end)
      filter (where tr.paid_at >= a.initial_balance_date) as paid,
    sum(case when tr.type = 'income' then tr.amount else -tr.amount end)
      filter (where tr.paid_at is null) as pending
  from public.transactions tr
  where tr.account_id = a.id
) t on true;
