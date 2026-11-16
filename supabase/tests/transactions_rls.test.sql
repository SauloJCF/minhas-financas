-- Lançamentos: isolamento entre usuários, vínculos com conta e categoria, e saldos.
begin;

create extension if not exists pgtap with schema extensions;

select plan(19);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'bia@example.com');

-- Uma conta para cada uma; as categorias vêm do conjunto padrão.
insert into public.accounts (id, user_id, name, type, initial_balance, initial_balance_date, color, icon) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'Conta da Ana', 'corrente', 100000, '2026-11-01', '#059669', 'landmark'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'Conta da Bia', 'corrente', 0, '2026-11-01', '#059669', 'landmark');

create temp table ids as
select
  (select id from public.categories where user_id = '00000000-0000-0000-0000-00000000000a' and name = 'Alimentação') as ana_expense,
  (select id from public.categories where user_id = '00000000-0000-0000-0000-00000000000a' and name = 'Salário') as ana_income,
  (select id from public.categories where user_id = '00000000-0000-0000-0000-00000000000b' and name = 'Alimentação') as bia_expense;
grant select on ids to authenticated;

select ok(
  (select relrowsecurity from pg_class where oid = 'public.transactions'::regclass),
  'transactions tem RLS ligado'
);

-- Ana.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select lives_ok(
  $$ insert into public.transactions (id, type, description, amount, account_id, category_id, due_date, paid_at)
     select '33333333-0000-0000-0000-000000000001', 'expense', 'Mercado', 25000, 'aaaaaaaa-0000-0000-0000-000000000001', ana_expense, '2026-11-10', '2026-11-10' from ids $$,
  'Ana lança uma despesa paga'
);

select lives_ok(
  $$ insert into public.transactions (type, description, amount, account_id, category_id, due_date)
     select 'income', 'Salário', 500000, 'aaaaaaaa-0000-0000-0000-000000000001', ana_income, '2026-11-30' from ids $$,
  'Ana lança uma receita pendente'
);

select results_eq(
  $$ select current_balance, forecast_balance from public.accounts_with_balance where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  $$ values (75000::bigint, 575000::bigint) $$,
  'só o lançamento pago altera o saldo atual; o pendente entra no saldo previsto'
);

select lives_ok(
  $$ insert into public.transactions (type, description, amount, account_id, category_id, due_date, paid_at)
     select 'expense', 'Antiga', 9900, 'aaaaaaaa-0000-0000-0000-000000000001', ana_expense, '2026-10-20', '2026-10-20' from ids $$,
  'Ana lança uma despesa paga antes da data do saldo inicial'
);

select is(
  (select current_balance from public.accounts_with_balance where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  75000::bigint,
  'pagamento anterior à data do saldo inicial não muda o saldo'
);

select throws_ok(
  $$ insert into public.transactions (type, description, amount, account_id, category_id, due_date)
     select 'expense', 'Zero', 0, 'aaaaaaaa-0000-0000-0000-000000000001', ana_expense, '2026-11-10' from ids $$,
  '23514', null,
  'o valor precisa ser positivo'
);

select throws_ok(
  $$ insert into public.transactions (type, description, amount, account_id, category_id, due_date)
     select 'income', 'Tipo trocado', 1000, 'aaaaaaaa-0000-0000-0000-000000000001', ana_expense, '2026-11-10' from ids $$,
  '23503', null,
  'a categoria precisa ser do mesmo tipo do lançamento'
);

select throws_ok(
  $$ insert into public.transactions (type, description, amount, account_id, category_id, due_date)
     select 'expense', 'Na conta da Bia', 1000, 'bbbbbbbb-0000-0000-0000-000000000001', ana_expense, '2026-11-10' from ids $$,
  '23503', null,
  'Ana não lança na conta de outro usuário'
);

select throws_ok(
  $$ insert into public.transactions (type, description, amount, account_id, category_id, due_date)
     select 'expense', 'Na categoria da Bia', 1000, 'aaaaaaaa-0000-0000-0000-000000000001', bia_expense, '2026-11-10' from ids $$,
  '23503', null,
  'Ana não usa categoria de outro usuário'
);

select throws_ok(
  $$ insert into public.transactions (user_id, type, description, amount, account_id, category_id, due_date)
     select '00000000-0000-0000-0000-00000000000b', 'expense', 'Para a Bia', 1000, 'bbbbbbbb-0000-0000-0000-000000000001', bia_expense, '2026-11-10' from ids $$,
  '42501', null,
  'Ana não lança em nome de outro usuário'
);

select throws_ok(
  $$ delete from public.accounts where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  '23503', null,
  'conta com lançamentos não pode ser excluída'
);

select throws_ok(
  $$ delete from public.categories where id = (select ana_expense from ids) $$,
  '23503', null,
  'categoria com lançamentos não pode ser excluída'
);

-- Bia não enxerga nem mexe nos lançamentos da Ana.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

select is_empty($$ select * from public.transactions $$, 'Bia não lê lançamentos da Ana');

update public.transactions set description = 'Invadido', paid_at = null where id = '33333333-0000-0000-0000-000000000001';
delete from public.transactions where id = '33333333-0000-0000-0000-000000000001';

-- Ana confere que nada mudou, desfaz o pagamento e exclui.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select results_eq(
  $$ select description, paid_at from public.transactions where id = '33333333-0000-0000-0000-000000000001' $$,
  $$ values ('Mercado'::text, '2026-11-10'::date) $$,
  'a alteração e a exclusão feitas pela Bia não atingem o lançamento da Ana'
);

select lives_ok(
  $$ update public.transactions set paid_at = null where id = '33333333-0000-0000-0000-000000000001' $$,
  'Ana desfaz o pagamento'
);

select results_eq(
  $$ select current_balance, forecast_balance from public.accounts_with_balance where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  $$ values (100000::bigint, 575000::bigint) $$,
  'desfeito o pagamento, o saldo atual volta e o previsto continua'
);

select lives_ok(
  $$ delete from public.transactions where id = '33333333-0000-0000-0000-000000000001' $$,
  'Ana exclui o lançamento'
);

-- Quem não está logado não tem acesso nenhum.
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select throws_ok($$ select * from public.transactions $$, '42501', null, 'anônimo não lê lançamentos');

reset role;
select * from finish();
rollback;
