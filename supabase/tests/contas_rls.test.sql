-- Contas: um usuário não lê nem altera contas de outro (ADR 0002).
begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'bia@example.com');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.contas'::regclass),
  'contas tem RLS ligado'
);

-- Ana cria uma conta, sem informar user_id.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select lives_ok(
  $$ insert into public.contas (id, nome, tipo, saldo_inicial, cor, icone)
     values ('11111111-1111-1111-1111-111111111111', 'Carteira da Ana', 'dinheiro', 12345, '#16a34a', 'wallet') $$,
  'Ana cria uma conta'
);

select is(
  (select user_id from public.contas where id = '11111111-1111-1111-1111-111111111111'),
  '00000000-0000-0000-0000-00000000000a'::uuid,
  'a conta nasce pertencendo a quem a criou'
);

select is(
  (select saldo_atual from public.contas_com_saldo where id = '11111111-1111-1111-1111-111111111111'),
  12345::bigint,
  'o saldo atual é o saldo inicial'
);

select throws_ok(
  $$ insert into public.contas (user_id, nome, tipo, cor, icone)
     values ('00000000-0000-0000-0000-00000000000b', 'Para a Bia', 'corrente', '#16a34a', 'wallet') $$,
  '42501', null,
  'Ana não cria conta em nome de outro usuário'
);

select throws_ok(
  $$ update public.contas set user_id = '00000000-0000-0000-0000-00000000000b'
     where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null,
  'Ana não passa uma conta sua para outro usuário'
);

select throws_ok(
  $$ insert into public.contas (nome, tipo, cor, icone) values ('  ', 'corrente', '#16a34a', 'wallet') $$,
  '23514', null,
  'conta sem nome é recusada'
);

select lives_ok(
  $$ insert into public.contas (nome, tipo, saldo_inicial, cor, icone)
     values ('Cartão', 'cartao', -50000, '#dc2626', 'credit-card') $$,
  'saldo inicial pode ser negativo'
);

-- Bia não enxerga nem mexe na conta da Ana.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

select is_empty($$ select * from public.contas $$, 'Bia não lê contas da Ana');
select is_empty($$ select * from public.contas_com_saldo $$, 'Bia não lê contas da Ana pela view de saldo');

update public.contas set nome = 'Invadida', arquivada = true where id = '11111111-1111-1111-1111-111111111111';
delete from public.contas where id = '11111111-1111-1111-1111-111111111111';

-- Ana confere que nada mudou.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select results_eq(
  $$ select nome, arquivada from public.contas where id = '11111111-1111-1111-1111-111111111111' $$,
  $$ values ('Carteira da Ana'::text, false) $$,
  'a alteração e a exclusão feitas pela Bia não atingem a conta da Ana'
);

select lives_ok(
  $$ update public.contas set arquivada = true where id = '11111111-1111-1111-1111-111111111111' $$,
  'Ana arquiva a própria conta'
);

select is(
  (select arquivada from public.contas where id = '11111111-1111-1111-1111-111111111111'),
  true,
  'a conta fica arquivada'
);

select lives_ok(
  $$ delete from public.contas where id = '11111111-1111-1111-1111-111111111111' $$,
  'Ana exclui a própria conta'
);

select is(
  (select count(*) from public.contas where id = '11111111-1111-1111-1111-111111111111'),
  0::bigint,
  'a conta excluída some'
);

-- Quem não está logado não tem acesso nenhum.
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select throws_ok($$ select * from public.contas $$, '42501', null, 'anônimo não lê contas');
select throws_ok($$ select * from public.contas_com_saldo $$, '42501', null, 'anônimo não lê a view de saldo');

reset role;
select * from finish();
rollback;
