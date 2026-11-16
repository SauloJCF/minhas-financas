-- Orçamento: limite mensal em categoria de despesa.
begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'bia@example.com');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select lives_ok(
  $$ update public.categories set monthly_budget = 80000 where name = 'Alimentação' $$,
  'Ana define o limite mensal de uma categoria de despesa'
);

select is(
  (select monthly_budget from public.categories where name = 'Alimentação'),
  80000::bigint,
  'o limite fica gravado em centavos'
);

select lives_ok(
  $$ insert into public.categories (name, type, color, icon, monthly_budget) values ('Pets', 'expense', '#059669', 'ellipsis', 15000) $$,
  'uma categoria de despesa pode nascer com limite'
);

select throws_ok(
  $$ update public.categories set monthly_budget = 100000 where name = 'Salário' $$,
  '23514', null,
  'categoria de receita não tem limite'
);

select throws_ok(
  $$ update public.categories set monthly_budget = 0 where name = 'Alimentação' $$,
  '23514', null,
  'o limite é positivo; para tirar, usa-se nulo'
);

select lives_ok(
  $$ update public.categories set monthly_budget = null where name = 'Alimentação' $$,
  'Ana remove o limite'
);

-- Bia não altera o limite das categorias da Ana.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
update public.categories set monthly_budget = 1 where name = 'Pets';

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select is(
  (select monthly_budget from public.categories where name = 'Pets'),
  15000::bigint,
  'a alteração feita pela Bia não atinge a categoria da Ana'
);

reset role;
select * from finish();
rollback;
