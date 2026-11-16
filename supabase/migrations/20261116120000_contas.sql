-- Fatia 3: contas. Primeira tabela do app.
-- Toda tabela tem user_id e RLS com a regra única `user_id = auth.uid()` (ADR 0001 e 0002).

create type public.tipo_conta as enum ('corrente', 'poupanca', 'dinheiro', 'cartao', 'investimento');

create table public.contas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null check (nome = btrim(nome) and char_length(nome) between 1 and 60),
  -- Serve só para agrupar e exibir; cartão é uma conta comum, com saldo negativo.
  tipo public.tipo_conta not null,
  -- Em centavos. Ao contrário dos valores de lançamentos, um saldo pode ser negativo.
  saldo_inicial bigint not null default 0,
  -- Data de referência do saldo inicial: o que veio antes dela já está contado nele.
  data_saldo_inicial date not null default current_date,
  cor text not null check (cor ~ '^#[0-9a-f]{6}$'),
  -- Chave de um ícone conhecido pelo front, que tem um ícone de reserva para chaves novas.
  icone text not null check (icone ~ '^[a-z0-9-]{1,40}$'),
  arquivada boolean not null default false,
  created_at timestamptz not null default now()
);

create index contas_user_id_idx on public.contas (user_id);

alter table public.contas enable row level security;

revoke all on public.contas from anon;
grant select, insert, update, delete on public.contas to authenticated;

-- (select auth.uid()) é avaliado uma vez por consulta, e não uma vez por linha.
create policy "Usuário lê as próprias contas" on public.contas
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Usuário cria as próprias contas" on public.contas
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Usuário altera as próprias contas" on public.contas
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Usuário exclui as próprias contas" on public.contas
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- O saldo atual nunca é uma coluna armazenada: é sempre calculado aqui. Por enquanto é só o
-- saldo inicial; as fatias de lançamentos e de transferências estendem esta view somando os
-- lançamentos pagos e as transferências.
-- security_invoker: a view respeita o RLS de quem consulta, e não o do dono dela.
create view public.contas_com_saldo
with (security_invoker = true) as
select
  c.id,
  c.user_id,
  c.nome,
  c.tipo,
  c.saldo_inicial,
  c.data_saldo_inicial,
  c.cor,
  c.icone,
  c.arquivada,
  c.created_at,
  c.saldo_inicial as saldo_atual
from public.contas c;

revoke all on public.contas_com_saldo from anon;
grant select on public.contas_com_saldo to authenticated;
