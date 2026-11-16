-- Fase 2, fatia 1: lançamentos recorrentes. Uma série liga lançamentos comuns gerados de
-- antemão, uma linha por ocorrência. Não há geração automática no servidor (ADR 0001): as
-- ocorrências nascem na criação da série ou no "estender".

-- 'installment' (parcelamento) já existe no enum para a fatia seguinte.
create type public.series_kind as enum ('recurrence', 'installment');
create type public.series_frequency as enum ('weekly', 'monthly', 'yearly');

create table public.transaction_series (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind public.series_kind not null,
  frequency public.series_frequency not null,
  -- Vencimento da primeira ocorrência. Todas as datas da série são calculadas a partir dele,
  -- para que um dia 31 volte a ser 31 depois de um mês mais curto.
  start_date date not null,
  -- Total de parcelas; só parcelamentos têm um total.
  installment_count integer check (installment_count between 2 and 48),
  created_at timestamptz not null default now(),
  constraint transaction_series_count_matches_kind
    check ((kind = 'installment') = (installment_count is not null)),
  constraint transaction_series_id_user_id_key unique (id, user_id)
);

create index transaction_series_user_id_idx on public.transaction_series (user_id);

alter table public.transaction_series enable row level security;

revoke all on public.transaction_series from anon, authenticated;
-- Sem update: uma série não muda depois de criada.
grant select, insert, delete on public.transaction_series to authenticated;

create policy "transaction_series_select_own" on public.transaction_series
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "transaction_series_insert_own" on public.transaction_series
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "transaction_series_delete_own" on public.transaction_series
  for delete to authenticated
  using (user_id = (select auth.uid()));

alter table public.transactions
  add column group_id uuid,
  -- Posição na série, a partir de 1.
  add column installment_number integer check (installment_number >= 1),
  add constraint transactions_series_fields_together
    check ((group_id is null) = (installment_number is null)),
  -- O `user_id` na chave impede entrar na série de outro usuário.
  add constraint transactions_series_fkey
    foreign key (group_id, user_id) references public.transaction_series (id, user_id) on delete cascade,
  add constraint transactions_group_id_installment_number_key unique (group_id, installment_number);

-- Vencimento da ocorrência `occurrence` (a partir de 1) de uma série. Somar meses a uma data
-- no Postgres já cai no último dia quando o dia não existe no mês.
create function public.series_due_date(start_date date, frequency public.series_frequency, occurrence integer)
returns date
language sql
immutable
set search_path = ''
as $$
  select case frequency
    when 'weekly' then start_date + (occurrence - 1) * 7
    when 'monthly' then (start_date + make_interval(months => occurrence - 1))::date
    when 'yearly' then (start_date + make_interval(years => occurrence - 1))::date
  end;
$$;

-- Cria uma recorrência com 12 ocorrências, tudo ou nada. A primeira leva o pagamento
-- informado; as demais nascem pendentes. Roda com os direitos de quem chama: vale a RLS.
create function public.create_recurrence(
  p_type public.transaction_type,
  p_description text,
  p_amount bigint,
  p_account_id uuid,
  p_category_id uuid,
  p_due_date date,
  p_paid_at date,
  p_notes text,
  p_frequency public.series_frequency
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_series_id uuid;
begin
  insert into public.transaction_series (kind, frequency, start_date)
  values ('recurrence', p_frequency, p_due_date)
  returning id into v_series_id;

  insert into public.transactions
    (type, description, amount, account_id, category_id, due_date, paid_at, notes, group_id, installment_number)
  select
    p_type, p_description, p_amount, p_account_id, p_category_id,
    public.series_due_date(p_due_date, p_frequency, n),
    case when n = 1 then p_paid_at end,
    p_notes, v_series_id, n
  from generate_series(1, 12) as n;

  return v_series_id;
end;
$$;

-- Estende uma recorrência por mais 12 ocorrências pendentes, copiadas da última existente.
create function public.extend_recurrence(p_series_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_series public.transaction_series;
  v_last public.transactions;
begin
  select * into v_series from public.transaction_series where id = p_series_id and kind = 'recurrence';
  if not found then
    raise exception 'recorrência não encontrada' using errcode = 'P0002';
  end if;

  select * into v_last from public.transactions
  where group_id = p_series_id
  order by installment_number desc
  limit 1;
  if not found then
    raise exception 'recorrência sem ocorrências' using errcode = 'P0002';
  end if;

  insert into public.transactions
    (type, description, amount, account_id, category_id, due_date, notes, group_id, installment_number)
  select
    v_last.type, v_last.description, v_last.amount, v_last.account_id, v_last.category_id,
    public.series_due_date(v_series.start_date, v_series.frequency, v_last.installment_number + n),
    v_last.notes, p_series_id, v_last.installment_number + n
  from generate_series(1, 12) as n;
end;
$$;

revoke all on function public.series_due_date(date, public.series_frequency, integer) from public, anon;
revoke all on function public.create_recurrence(public.transaction_type, text, bigint, uuid, uuid, date, date, text, public.series_frequency) from public, anon;
revoke all on function public.extend_recurrence(uuid) from public, anon;
grant execute on function public.series_due_date(date, public.series_frequency, integer) to authenticated;
grant execute on function public.create_recurrence(public.transaction_type, text, bigint, uuid, uuid, date, date, text, public.series_frequency) to authenticated;
grant execute on function public.extend_recurrence(uuid) to authenticated;
