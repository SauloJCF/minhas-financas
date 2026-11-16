-- Configurações do assistente: uma linha por usuário, isolada dos demais (ADR 0002).
begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'bia@example.com');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.assistant_settings'::regclass),
  'assistant_settings tem RLS ligado'
);

-- Ana.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select lives_ok(
  $$ insert into public.assistant_settings (openrouter_key, model) values ('sk-or-ana', 'google/gemma:free') $$,
  'Ana grava as suas configurações'
);

select results_eq(
  $$ select openrouter_key, model, free_only from public.assistant_settings $$,
  $$ values ('sk-or-ana'::text, 'google/gemma:free'::text, true) $$,
  'só gratuitos vem ligado por padrão'
);

select throws_ok(
  $$ insert into public.assistant_settings (openrouter_key) values ('outra') $$,
  '23505', null,
  'cada usuário tem uma linha só'
);

select throws_ok(
  $$ insert into public.assistant_settings (user_id, openrouter_key)
     values ('00000000-0000-0000-0000-00000000000b', 'sk-or-para-a-bia') $$,
  '42501', null,
  'Ana não grava configurações em nome de outro usuário'
);

select throws_ok(
  $$ update public.assistant_settings set user_id = '00000000-0000-0000-0000-00000000000b' $$,
  '42501', null,
  'Ana não passa as suas configurações para outro usuário'
);

select throws_ok(
  $$ update public.assistant_settings set openrouter_key = '' $$,
  '23514', null,
  'chave vazia não entra; para remover, usa-se nulo'
);

select lives_ok(
  $$ update public.assistant_settings set openrouter_key = null, model = 'openai/gpt', free_only = false $$,
  'Ana remove a chave e troca o modelo'
);

update public.assistant_settings set openrouter_key = 'sk-or-ana';

-- Bia não enxerga nem mexe nas configurações da Ana.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

select is_empty($$ select * from public.assistant_settings $$, 'Bia não lê a chave da Ana');

update public.assistant_settings set openrouter_key = 'invadida';
delete from public.assistant_settings;

select lives_ok(
  $$ insert into public.assistant_settings (openrouter_key) values ('sk-or-bia') $$,
  'Bia grava as próprias configurações'
);

-- Ana confere que nada mudou e apaga as suas.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select results_eq(
  $$ select openrouter_key from public.assistant_settings $$,
  $$ values ('sk-or-ana'::text) $$,
  'a alteração e a exclusão feitas pela Bia não atingem as configurações da Ana'
);

select lives_ok($$ delete from public.assistant_settings $$, 'Ana apaga as próprias configurações');

-- Quem não está logado não tem acesso nenhum.
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select throws_ok(
  $$ select * from public.assistant_settings $$,
  '42501', null,
  'anônimo não lê configurações do assistente'
);

reset role;
select * from finish();
rollback;
