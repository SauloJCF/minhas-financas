-- Séries: geração das ocorrências de uma recorrência, extensão e isolamento entre usuários.
begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'bia@example.com');

insert into public.accounts (id, user_id, name, type, initial_balance, initial_balance_date, color, icon) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'Conta da Ana', 'corrente', 0, '2026-01-01', '#059669', 'landmark'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'Conta da Bia', 'corrente', 0, '2026-01-01', '#059669', 'landmark');

create temp table ids as
select
  (select id from public.categories where user_id = '00000000-0000-0000-0000-00000000000a' and name = 'Moradia') as ana_expense,
  (select id from public.categories where user_id = '00000000-0000-0000-0000-00000000000b' and name = 'Moradia') as bia_expense,
  null::uuid as monthly,
  null::uuid as weekly;
grant select, update on ids to authenticated;

select ok(
  (select relrowsecurity from pg_class where oid = 'public.transaction_series'::regclass),
  'transaction_series tem RLS ligado'
);

-- Ana.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select lives_ok(
  $$ update ids set monthly = public.create_recurrence(
       'expense', 'Aluguel', 150000, 'aaaaaaaa-0000-0000-0000-000000000001', ana_expense, '2026-01-31', '2026-01-31', null, 'monthly') $$,
  'Ana cria uma recorrência mensal no dia 31'
);

select is(
  (select count(*) from public.transactions where group_id = (select monthly from ids)),
  12::bigint,
  'a recorrência nasce com 12 ocorrências'
);

select results_eq(
  $$ select due_date from public.transactions where group_id = (select monthly from ids) and installment_number <= 4 order by installment_number $$,
  $$ values ('2026-01-31'::date), ('2026-02-28'::date), ('2026-03-31'::date), ('2026-04-30'::date) $$,
  'dia que não existe no mês cai no último dia, e os meses seguintes voltam ao dia original'
);

select is(
  (select max(due_date) from public.transactions where group_id = (select monthly from ids)),
  '2026-12-31'::date,
  'a décima segunda ocorrência mensal vence onze meses depois da primeira'
);

select results_eq(
  $$ select count(*) filter (where paid_at is not null), count(*) filter (where paid_at is null)
     from public.transactions where group_id = (select monthly from ids) $$,
  $$ values (1::bigint, 11::bigint) $$,
  'só a primeira ocorrência leva o pagamento; as demais nascem pendentes'
);

select lives_ok(
  $$ update ids set weekly = public.create_recurrence(
       'expense', 'Feira', 8000, 'aaaaaaaa-0000-0000-0000-000000000001', ana_expense, '2026-11-02', null, null, 'weekly') $$,
  'Ana cria uma recorrência semanal'
);

select results_eq(
  $$ select due_date from public.transactions where group_id = (select weekly from ids) and installment_number in (2, 12) order by installment_number $$,
  $$ values ('2026-11-09'::date), ('2027-01-18'::date) $$,
  'ocorrências semanais avançam de sete em sete dias'
);

select is(
  public.series_due_date('2024-02-29', 'yearly', 2),
  '2025-02-28'::date,
  'recorrência anual em 29 de fevereiro cai no dia 28 nos anos comuns'
);

-- Estender copia a última ocorrência, com o que ela tiver de diferente.
update public.transactions set amount = 160000
where group_id = (select monthly from ids) and installment_number = 12;

select lives_ok(
  $$ select public.extend_recurrence((select monthly from ids)) $$,
  'Ana estende a recorrência'
);

select results_eq(
  $$ select installment_number, due_date, amount, paid_at from public.transactions
     where group_id = (select monthly from ids) and installment_number in (13, 14, 24) order by installment_number $$,
  $$ values (13, '2027-01-31'::date, 160000::bigint, null::date), (14, '2027-02-28'::date, 160000::bigint, null::date), (24, '2027-12-31'::date, 160000::bigint, null::date) $$,
  'a extensão continua a série sem pular datas, pendente e com os dados da última ocorrência'
);

select is(
  (select count(*) from public.transactions where group_id = (select monthly from ids)),
  24::bigint,
  'a extensão não duplica ocorrências'
);

select throws_ok(
  $$ select public.create_recurrence(
       'expense', 'Na conta da Bia', 1000, 'bbbbbbbb-0000-0000-0000-000000000001', ana_expense, '2026-11-10', null, null, 'monthly') from ids $$,
  '23503', null,
  'Ana não cria recorrência na conta de outro usuário'
);

select is(
  (select count(*) from public.transaction_series),
  2::bigint,
  'a criação que falha não deixa série pela metade'
);

-- Bia não enxerga nem mexe nas séries da Ana.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

select is_empty($$ select * from public.transaction_series $$, 'Bia não lê séries da Ana');

select throws_ok(
  $$ select public.extend_recurrence((select monthly from ids)) $$,
  'P0002', null,
  'Bia não estende a recorrência da Ana'
);

select throws_ok(
  $$ insert into public.transactions (type, description, amount, account_id, category_id, due_date, group_id, installment_number)
     select 'expense', 'Intrusa', 1000, 'bbbbbbbb-0000-0000-0000-000000000001', bia_expense, '2026-11-10', monthly, 99 from ids $$,
  '23503', null,
  'Bia não inclui um lançamento na série da Ana'
);

reset role;
select * from finish();
rollback;
