-- Parcelamentos: divisão do valor total, vencimentos mensais e limites.
begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'bia@example.com');

insert into public.accounts (id, user_id, name, type, initial_balance, initial_balance_date, color, icon) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'Conta da Ana', 'corrente', 0, '2026-01-01', '#059669', 'landmark');

create temp table ids as
select
  (select id from public.categories where user_id = '00000000-0000-0000-0000-00000000000a' and name = 'Lazer') as ana_expense,
  null::uuid as series,
  null::uuid as short_month;
grant select, update on ids to authenticated;

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select lives_ok(
  $$ update ids set series = public.create_installments(
       'expense', 'Televisão', 10000, 'aaaaaaaa-0000-0000-0000-000000000001', ana_expense, '2026-11-30', '2026-11-30', null, 3) $$,
  'Ana parcela R$ 100,00 em 3 vezes'
);

select results_eq(
  $$ select installment_number, amount, due_date, paid_at from public.transactions
     where group_id = (select series from ids) order by installment_number $$,
  $$ values (1, 3334::bigint, '2026-11-30'::date, '2026-11-30'::date),
            (2, 3333::bigint, '2026-12-30'::date, null::date),
            (3, 3333::bigint, '2027-01-30'::date, null::date) $$,
  'os centavos que sobram vão na primeira parcela, e só ela leva o pagamento'
);

select is(
  (select sum(amount) from public.transactions where group_id = (select series from ids)),
  10000::numeric,
  'a soma das parcelas é exatamente o total'
);

select results_eq(
  $$ select kind, frequency, installment_count from public.transaction_series where id = (select series from ids) $$,
  $$ values ('installment'::public.series_kind, 'monthly'::public.series_frequency, 3) $$,
  'a série guarda o tipo e o total de parcelas'
);

update ids set short_month = public.create_installments(
  'expense', 'Curso', 120000, 'aaaaaaaa-0000-0000-0000-000000000001', ana_expense, '2026-01-31', null, null, 2);

select is(
  (select max(due_date) from public.transactions where group_id = (select short_month from ids)),
  '2026-02-28'::date,
  'parcela em dia que não existe no mês cai no último dia'
);

select throws_ok(
  $$ select public.create_installments(
       'expense', 'Uma só', 10000, 'aaaaaaaa-0000-0000-0000-000000000001', ana_expense, '2026-11-10', null, null, 1) from ids $$,
  '23514', null,
  'um parcelamento tem pelo menos 2 parcelas'
);

select throws_ok(
  $$ select public.create_installments(
       'expense', 'Demais', 1000000, 'aaaaaaaa-0000-0000-0000-000000000001', ana_expense, '2026-11-10', null, null, 49) from ids $$,
  '23514', null,
  'um parcelamento tem no máximo 48 parcelas'
);

select throws_ok(
  $$ select public.create_installments(
       'expense', 'Centavos', 2, 'aaaaaaaa-0000-0000-0000-000000000001', ana_expense, '2026-11-10', null, null, 3) from ids $$,
  '23514', null,
  'o total precisa dar pelo menos um centavo por parcela'
);

select throws_ok(
  $$ select public.extend_recurrence((select series from ids)) $$,
  'P0002', null,
  'parcelamento não pode ser estendido'
);

-- Bia não enxerga o parcelamento da Ana.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

select is_empty($$ select * from public.transactions $$, 'Bia não lê as parcelas da Ana');

reset role;
select * from finish();
rollback;
