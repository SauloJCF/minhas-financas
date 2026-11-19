-- Tickets (#46): o pedido de mudança de um usuário vira uma issue no GitHub. O banco guarda só
-- a ligação ticket <-> usuário <-> issue; situação e conversa vêm do GitHub, lidas pela Edge
-- Function `tickets` (ADR 0011).

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  issue_number integer not null check (issue_number > 0),
  type text not null check (type in ('improvement', 'fix')),
  title text not null check (title = btrim(title) and char_length(title) between 1 and 100),
  created_at timestamptz not null default now()
);

create index tickets_user_id_created_at_idx on public.tickets (user_id, created_at desc);

alter table public.tickets enable row level security;

-- Sem UPDATE e sem DELETE: cancelar ou apagar ticket está fora desta fatia.
revoke all on public.tickets from anon, authenticated;
grant select, insert on public.tickets to authenticated;

create policy "tickets_select_own" on public.tickets
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "tickets_insert_own" on public.tickets
  for insert to authenticated
  with check (user_id = (select auth.uid()));
