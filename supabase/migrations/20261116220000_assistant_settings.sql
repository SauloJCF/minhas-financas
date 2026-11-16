-- Assistente (#37): as configurações do chat de IA, uma linha por usuário. A chave do
-- OpenRouter fica aqui para valer em todos os aparelhos; quem a lê é o front do próprio dono,
-- que é quem chama o OpenRouter (ADR 0008).

create table public.assistant_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  -- Nulo enquanto o usuário não informa a chave, ou depois de removê-la.
  openrouter_key text check (
    openrouter_key is null
    or (openrouter_key = btrim(openrouter_key) and char_length(openrouter_key) between 1 and 500)
  ),
  -- Id do modelo no OpenRouter, como "google/gemma-4-31b-it:free".
  model text check (model is null or char_length(model) between 1 and 200),
  -- O seletor de modelos só oferece os gratuitos.
  free_only boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.assistant_settings enable row level security;

revoke all on public.assistant_settings from anon, authenticated;
grant select, insert, delete on public.assistant_settings to authenticated;
-- O dono não muda: não há permissão de UPDATE em `user_id`.
grant update (openrouter_key, model, free_only) on public.assistant_settings to authenticated;

create policy "assistant_settings_select_own" on public.assistant_settings
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "assistant_settings_insert_own" on public.assistant_settings
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "assistant_settings_update_own" on public.assistant_settings
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "assistant_settings_delete_own" on public.assistant_settings
  for delete to authenticated
  using (user_id = (select auth.uid()));
