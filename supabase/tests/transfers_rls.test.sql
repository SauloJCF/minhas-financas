-- Transferências: isolamento, contas do próprio usuário, saldos e extrato.
begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'bia@example.com');

insert into public.accounts (id, user_id, name, type, initial_balance, initial_balance_date, color, icon) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'Corrente da Ana', 'corrente', 100000, '2026-11-01', '#059669', 'landmark'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'Poupança da Ana', 'poupanca', 0, '2026-11-01', '#059669', 'piggy-bank'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'Conta da Bia', 'corrente', 0, '2026-11-01', '#059669', 'landmark');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.transfers'::regclass),
  'transfers tem RLS ligado'
);

-- Ana.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select lives_ok(
  $$ insert into public.transfers (id, from_account_id, to_account_id, amount, date)
     values ('44444444-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 30000, '2026-11-10') $$,
  'Ana transfere da corrente para a poupança'
);

select results_eq(
  $$ select current_balance, forecast_balance from public.accounts_with_balance
     where user_id = '00000000-0000-0000-0000-00000000000a' order by name $$,
  $$ values (70000::bigint, 70000::bigint), (30000::bigint, 30000::bigint) $$,
  'a transferência sai do saldo da origem e entra no do destino'
);

select results_eq(
  $$ select account_id, amount, other_account_id from public.account_statement
     where id = '44444444-0000-0000-0000-000000000001' order by amount $$,
  $$ values
    ('aaaaaaaa-0000-0000-0000-000000000001'::uuid, -30000::bigint, 'aaaaaaaa-0000-0000-0000-000000000002'::uuid),
    ('aaaaaaaa-0000-0000-0000-000000000002'::uuid, 30000::bigint, 'aaaaaaaa-0000-0000-0000-000000000001'::uuid) $$,
  'o extrato mostra a transferência nas duas contas, com o sinal de cada lado'
);

select lives_ok(
  $$ insert into public.transfers (from_account_id, to_account_id, amount, date)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 5000, '2026-10-15') $$,
  'Ana registra uma transferência anterior à data do saldo inicial'
);

select is(
  (select current_balance from public.accounts_with_balance where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  70000::bigint,
  'transferência anterior à data do saldo inicial não muda o saldo'
);

select throws_ok(
  $$ insert into public.transfers (from_account_id, to_account_id, amount, date)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 1000, '2026-11-10') $$,
  '23514', null,
  'origem e destino precisam ser contas diferentes'
);

select throws_ok(
  $$ insert into public.transfers (from_account_id, to_account_id, amount, date)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 0, '2026-11-10') $$,
  '23514', null,
  'o valor precisa ser positivo'
);

select throws_ok(
  $$ insert into public.transfers (from_account_id, to_account_id, amount, date)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 1000, '2026-11-10') $$,
  '23503', null,
  'Ana não transfere para a conta de outro usuário'
);

select throws_ok(
  $$ insert into public.transfers (from_account_id, to_account_id, amount, date)
     values ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 1000, '2026-11-10') $$,
  '23503', null,
  'Ana não transfere da conta de outro usuário'
);

select throws_ok(
  $$ delete from public.accounts where id = 'aaaaaaaa-0000-0000-0000-000000000002' $$,
  '23503', null,
  'conta com transferências não pode ser excluída'
);

-- Bia não enxerga nem mexe nas transferências da Ana.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

select is_empty($$ select * from public.transfers $$, 'Bia não lê transferências da Ana');
select is_empty($$ select * from public.account_statement $$, 'Bia não lê o extrato da Ana');

delete from public.transfers where id = '44444444-0000-0000-0000-000000000001';

-- Ana confere que nada mudou.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select is(
  (select amount from public.transfers where id = '44444444-0000-0000-0000-000000000001'),
  30000::bigint,
  'a exclusão feita pela Bia não atinge a transferência da Ana'
);

-- Quem não está logado não tem acesso nenhum.
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select throws_ok($$ select * from public.transfers $$, '42501', null, 'anônimo não lê transferências');

reset role;
select * from finish();
rollback;
