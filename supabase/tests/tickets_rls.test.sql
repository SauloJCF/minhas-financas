-- Tickets: cada usuário vê e cria só os seus (ADR 0002); a linha não muda nem some.
begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'bia@example.com');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.tickets'::regclass),
  'tickets tem RLS ligado'
);

-- Ana.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select lives_ok(
  $$ insert into public.tickets (issue_number, type, title) values (101, 'fix', 'Saldo errado') $$,
  'Ana abre um ticket'
);

select results_eq(
  $$ select user_id from public.tickets $$,
  $$ values ('00000000-0000-0000-0000-00000000000a'::uuid) $$,
  'o dono é preenchido com o usuário logado'
);

select throws_ok(
  $$ insert into public.tickets (user_id, issue_number, type, title)
     values ('00000000-0000-0000-0000-00000000000b', 102, 'fix', 'Em nome da Bia') $$,
  '42501', null,
  'Ana não abre ticket em nome de outro usuário'
);

select throws_ok(
  $$ insert into public.tickets (issue_number, type, title) values (103, 'duvida', 'Tipo inválido') $$,
  '23514', null,
  'o tipo é melhoria ou correção'
);

select throws_ok(
  $$ insert into public.tickets (issue_number, type, title) values (104, 'fix', repeat('a', 101)) $$,
  '23514', null,
  'o título tem até 100 caracteres'
);

select throws_ok(
  $$ update public.tickets set title = 'Outro' $$,
  '42501', null,
  'o ticket não pode ser alterado'
);

select throws_ok(
  $$ delete from public.tickets $$,
  '42501', null,
  'o ticket não pode ser apagado'
);

-- Bia não vê o ticket da Ana.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

select is_empty(
  $$ select * from public.tickets $$,
  'Bia não enxerga o ticket da Ana'
);

-- Quem não está logado não vê nada.
set local role anon;
select throws_ok(
  $$ select * from public.tickets $$,
  '42501', null,
  'anônimo não lê tickets'
);

reset role;
select is(
  (select count(*) from public.tickets),
  1::bigint,
  'o ticket da Ana continua lá'
);

select * from finish();
rollback;
