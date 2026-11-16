-- Fatura de cartão: dias do ciclo na conta e pagamento da fatura.
begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'bia@example.com');

insert into public.accounts (id, user_id, name, type, initial_balance, initial_balance_date, color, icon, closing_day, due_day) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'Corrente da Ana', 'corrente', 500000, '2026-01-01', '#059669', 'landmark', null, null),
  ('aaaaaaaa-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'Cartão da Ana', 'cartao', 0, '2026-01-01', '#9333ea', 'credit-card', 10, 17),
  ('bbbbbbbb-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'Corrente da Bia', 'corrente', 0, '2026-01-01', '#059669', 'landmark', null, null);

create temp table ids as
select (select id from public.categories where user_id = '00000000-0000-0000-0000-00000000000a' and name = 'Lazer') as ana_expense,
       (select id from public.categories where user_id = '00000000-0000-0000-0000-00000000000a' and name = 'Outros' and type = 'income') as ana_income;
grant select on ids to authenticated;

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select throws_ok(
  $$ update public.accounts set closing_day = 10, due_day = 17 where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  '23514', null,
  'só conta cartão tem dias de fechamento e de vencimento'
);

select throws_ok(
  $$ update public.accounts set due_day = null where id = 'aaaaaaaa-0000-0000-0000-000000000002' $$,
  '23514', null,
  'fechamento e vencimento andam juntos'
);

select throws_ok(
  $$ update public.accounts set closing_day = 32 where id = 'aaaaaaaa-0000-0000-0000-000000000002' $$,
  '23514', null,
  'o dia de fechamento vai de 1 a 31'
);

select results_eq(
  $$ select closing_day, due_day from public.accounts_with_balance where id = 'aaaaaaaa-0000-0000-0000-000000000002' $$,
  $$ values (10::smallint, 17::smallint) $$,
  'a view de contas traz os dias do ciclo'
);

-- Fatura de 10/10 a 09/11: uma compra à vista (paga na compra), uma parcela pendente e um
-- estorno. A compra do dia 10/11 já é da fatura seguinte.
insert into public.transactions (type, description, amount, account_id, category_id, due_date, paid_at)
select v.type::public.transaction_type, v.description, v.amount, 'aaaaaaaa-0000-0000-0000-000000000002',
       case when v.type = 'income' then ids.ana_income else ids.ana_expense end, v.due_date::date, v.paid_at::date
from ids, (values
  ('expense', 'Mercado', 20000, '2026-10-15', '2026-10-15'),
  ('expense', 'Televisão', 30000, '2026-11-09', null),
  ('income', 'Estorno', 5000, '2026-10-20', '2026-10-20'),
  ('expense', 'Farmácia', 7000, '2026-11-10', null)
) as v(type, description, amount, due_date, paid_at);

select is(
  public.pay_card_statement('aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', '2026-11-17', '2026-10-10', '2026-11-09'),
  45000::bigint,
  'pagar a fatura devolve o total: despesas menos estornos do período'
);

select results_eq(
  $$ select description, paid_at from public.transactions
     where account_id = 'aaaaaaaa-0000-0000-0000-000000000002' and description in ('Televisão', 'Farmácia') order by description $$,
  $$ values ('Farmácia'::text, null::date), ('Televisão'::text, '2026-11-09'::date) $$,
  'os pendentes da fatura ficam pagos no próprio vencimento; os da fatura seguinte continuam pendentes'
);

select results_eq(
  $$ select from_account_id, to_account_id, amount, date from public.transfers $$,
  $$ values ('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'aaaaaaaa-0000-0000-0000-000000000002'::uuid, 45000::bigint, '2026-11-17'::date) $$,
  'o pagamento é uma transferência da conta de origem para o cartão'
);

select results_eq(
  $$ select current_balance, forecast_balance from public.accounts_with_balance where id = 'aaaaaaaa-0000-0000-0000-000000000002' $$,
  $$ values (0::bigint, -7000::bigint) $$,
  'paga a fatura, a dívida do cartão zera; resta no previsto a compra da fatura seguinte'
);

select is(
  (select current_balance from public.accounts_with_balance where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  455000::bigint,
  'o valor da fatura sai da conta de origem'
);

select throws_ok(
  $$ select public.pay_card_statement('aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', '2026-11-17', '2026-08-10', '2026-09-09') $$,
  '22023', null,
  'fatura sem valor não é paga'
);

select throws_ok(
  $$ select public.pay_card_statement('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', '2026-11-17', '2026-10-10', '2026-11-09') $$,
  'P0002', null,
  'só conta cartão tem fatura para pagar'
);

select throws_ok(
  $$ select public.pay_card_statement('aaaaaaaa-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', '2026-12-17', '2026-11-10', '2026-12-09') $$,
  '23503', null,
  'Ana não paga a fatura com a conta de outro usuário'
);

-- Bia não paga nem enxerga a fatura da Ana.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

select throws_ok(
  $$ select public.pay_card_statement('aaaaaaaa-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', '2026-12-17', '2026-11-10', '2026-12-09') $$,
  'P0002', null,
  'Bia não paga a fatura do cartão da Ana'
);

reset role;
select * from finish();
rollback;
