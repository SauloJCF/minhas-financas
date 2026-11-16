-- Fatia 4: categorias. Lista plana; cada categoria é de receita ou de despesa.

-- O mesmo tipo classifica categorias e, na próxima fatia, lançamentos.
create type public.transaction_type as enum ('income', 'expense');

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 40),
  type public.transaction_type not null,
  color text not null check (color ~ '^#[0-9a-f]{6}$'),
  -- Chave de um ícone conhecido pelo front, que tem um ícone de reserva para chaves novas.
  icon text not null check (icon ~ '^[a-z0-9-]{1,40}$'),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  -- Alvo da chave estrangeira composta dos lançamentos, que garante categoria do mesmo tipo.
  unique (id, type)
);

create index categories_user_id_idx on public.categories (user_id);

alter table public.categories enable row level security;

revoke all on public.categories from anon, authenticated;
grant select, insert, delete on public.categories to authenticated;
-- O tipo (e o dono) não mudam depois de criada: não há permissão de UPDATE nessas colunas.
grant update (name, color, icon, archived) on public.categories to authenticated;

create policy "categories_select_own" on public.categories
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "categories_insert_own" on public.categories
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "categories_update_own" on public.categories
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "categories_delete_own" on public.categories
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Conjunto padrão que todo usuário recebe ao ser criado, e que depois pode editar.
create function public.create_default_categories(target_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.categories (user_id, name, type, color, icon) values
    (target_user_id, 'Alimentação', 'expense', '#ea580c', 'utensils'),
    (target_user_id, 'Moradia', 'expense', '#0284c7', 'house'),
    (target_user_id, 'Transporte', 'expense', '#4f46e5', 'car'),
    (target_user_id, 'Saúde', 'expense', '#dc2626', 'heart-pulse'),
    (target_user_id, 'Lazer', 'expense', '#9333ea', 'gamepad-2'),
    (target_user_id, 'Educação', 'expense', '#db2777', 'graduation-cap'),
    (target_user_id, 'Outros', 'expense', '#475569', 'ellipsis'),
    (target_user_id, 'Salário', 'income', '#059669', 'briefcase'),
    (target_user_id, 'Rendimentos', 'income', '#0284c7', 'trending-up'),
    (target_user_id, 'Outros', 'income', '#475569', 'ellipsis');
$$;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.create_default_categories(new.id);
  return new;
end;
$$;

-- Só o gatilho chama estas funções; ninguém as executa pela API.
revoke all on function public.create_default_categories(uuid) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Quem já era usuário antes desta migration também recebe o conjunto padrão.
select public.create_default_categories(id) from auth.users;
