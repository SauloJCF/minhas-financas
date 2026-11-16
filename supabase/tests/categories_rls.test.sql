-- Categorias: conjunto padrão para todo usuário e isolamento entre usuários (ADR 0002).
begin;

create extension if not exists pgtap with schema extensions;

select plan(16);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'bia@example.com');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.categories'::regclass),
  'categories tem RLS ligado'
);

select is(
  (select count(*) from public.categories where user_id = '00000000-0000-0000-0000-00000000000a' and type = 'expense'),
  7::bigint,
  'usuário novo recebe as 7 categorias padrão de despesa'
);

select is(
  (select count(*) from public.categories where user_id = '00000000-0000-0000-0000-00000000000a' and type = 'income'),
  3::bigint,
  'usuário novo recebe as 3 categorias padrão de receita'
);

-- Ana.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select is((select count(*) from public.categories), 10::bigint, 'Ana lê só as suas categorias');

select lives_ok(
  $$ insert into public.categories (id, name, type, color, icon)
     values ('22222222-2222-2222-2222-222222222222', 'Pets', 'expense', '#059669', 'paw-print') $$,
  'Ana cria uma categoria'
);

select throws_ok(
  $$ insert into public.categories (user_id, name, type, color, icon)
     values ('00000000-0000-0000-0000-00000000000b', 'Para a Bia', 'expense', '#059669', 'gift') $$,
  '42501', null,
  'Ana não cria categoria em nome de outro usuário'
);

select throws_ok(
  $$ update public.categories set type = 'income' where id = '22222222-2222-2222-2222-222222222222' $$,
  '42501', null,
  'o tipo de uma categoria não muda depois de criada'
);

select throws_ok(
  $$ update public.categories set user_id = '00000000-0000-0000-0000-00000000000b'
     where id = '22222222-2222-2222-2222-222222222222' $$,
  '42501', null,
  'Ana não passa uma categoria sua para outro usuário'
);

select throws_ok(
  $$ select public.create_default_categories('00000000-0000-0000-0000-00000000000a') $$,
  '42501', null,
  'o conjunto padrão não pode ser recriado pela API'
);

-- Bia não enxerga nem mexe nas categorias da Ana.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

select is((select count(*) from public.categories), 10::bigint, 'Bia lê só as suas categorias');
select is_empty(
  $$ select * from public.categories where id = '22222222-2222-2222-2222-222222222222' $$,
  'Bia não lê a categoria da Ana'
);

update public.categories set name = 'Invadida', archived = true where id = '22222222-2222-2222-2222-222222222222';
delete from public.categories where id = '22222222-2222-2222-2222-222222222222';

-- Ana confere que nada mudou, arquiva e exclui.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select results_eq(
  $$ select name, archived from public.categories where id = '22222222-2222-2222-2222-222222222222' $$,
  $$ values ('Pets'::text, false) $$,
  'a alteração e a exclusão feitas pela Bia não atingem a categoria da Ana'
);

select lives_ok(
  $$ update public.categories set name = 'Animais', archived = true where id = '22222222-2222-2222-2222-222222222222' $$,
  'Ana renomeia e arquiva a própria categoria'
);

select lives_ok(
  $$ delete from public.categories where id = '22222222-2222-2222-2222-222222222222' $$,
  'Ana exclui a própria categoria'
);

select is((select count(*) from public.categories), 10::bigint, 'a categoria excluída some');

-- Quem não está logado não tem acesso nenhum.
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select throws_ok($$ select * from public.categories $$, '42501', null, 'anônimo não lê categorias');

reset role;
select * from finish();
rollback;
