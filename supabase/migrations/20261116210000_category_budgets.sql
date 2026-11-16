-- Fase 2, fatia 4: orçamento por categoria. O orçamento é um limite mensal único por
-- categoria de despesa, que vale para todos os meses até ser alterado; não há histórico por
-- mês. O consumo de cada mês é calculado no app, a partir dos lançamentos.

alter table public.categories
  -- Em centavos; nulo quando a categoria não tem limite.
  add column monthly_budget bigint check (monthly_budget > 0),
  add constraint categories_budget_only_on_expenses check (type = 'expense' or monthly_budget is null);

-- O update de categorias é liberado coluna a coluna (o tipo nunca muda).
grant update (monthly_budget) on public.categories to authenticated;
