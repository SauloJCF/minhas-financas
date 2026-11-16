-- Fase 2, fatia 2: parcelamentos. Um parcelamento é uma série de parcelas mensais, cada uma
-- um lançamento comum; a tabela de séries e as colunas vêm da fatia de recorrências.

-- Cria um parcelamento, tudo ou nada. `p_amount` é o valor total: o app divide pelo número
-- de parcelas e os centavos que sobram vão na primeira, para a soma fechar no total. A
-- primeira parcela leva o pagamento informado; as demais nascem pendentes.
create function public.create_installments(
  p_type public.transaction_type,
  p_description text,
  p_amount bigint,
  p_account_id uuid,
  p_category_id uuid,
  p_due_date date,
  p_paid_at date,
  p_notes text,
  p_count integer
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_series_id uuid;
  v_base bigint := p_amount / p_count;
  v_remainder bigint := p_amount - (p_amount / p_count) * p_count;
begin
  insert into public.transaction_series (kind, frequency, start_date, installment_count)
  values ('installment', 'monthly', p_due_date, p_count)
  returning id into v_series_id;

  insert into public.transactions
    (type, description, amount, account_id, category_id, due_date, paid_at, notes, group_id, installment_number)
  select
    p_type, p_description,
    case when n = 1 then v_base + v_remainder else v_base end,
    p_account_id, p_category_id,
    public.series_due_date(p_due_date, 'monthly', n),
    case when n = 1 then p_paid_at end,
    p_notes, v_series_id, n
  from generate_series(1, p_count) as n;

  return v_series_id;
end;
$$;

revoke all on function public.create_installments(public.transaction_type, text, bigint, uuid, uuid, date, date, text, integer) from public, anon;
grant execute on function public.create_installments(public.transaction_type, text, bigint, uuid, uuid, date, date, text, integer) to authenticated;
