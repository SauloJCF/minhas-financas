-- Identificadores do banco em inglês (ADR 0006). A fatia 3 criou `contas` em português;
-- aqui ela passa a `accounts`, sem perder dados. Os valores do tipo de conta continuam os mesmos.

drop view public.contas_com_saldo;

alter type public.tipo_conta rename to account_type;

alter table public.contas rename to accounts;
alter table public.accounts rename column nome to name;
alter table public.accounts rename column tipo to type;
alter table public.accounts rename column saldo_inicial to initial_balance;
alter table public.accounts rename column data_saldo_inicial to initial_balance_date;
alter table public.accounts rename column cor to color;
alter table public.accounts rename column icone to icon;
alter table public.accounts rename column arquivada to archived;

alter index public.contas_pkey rename to accounts_pkey;
alter index public.contas_user_id_idx rename to accounts_user_id_idx;
alter table public.accounts rename constraint contas_user_id_fkey to accounts_user_id_fkey;
alter table public.accounts rename constraint contas_nome_check to accounts_name_check;
alter table public.accounts rename constraint contas_cor_check to accounts_color_check;
alter table public.accounts rename constraint contas_icone_check to accounts_icon_check;

alter policy "Usuário lê as próprias contas" on public.accounts rename to "accounts_select_own";
alter policy "Usuário cria as próprias contas" on public.accounts rename to "accounts_insert_own";
alter policy "Usuário altera as próprias contas" on public.accounts rename to "accounts_update_own";
alter policy "Usuário exclui as próprias contas" on public.accounts rename to "accounts_delete_own";

-- O saldo atual nunca é uma coluna armazenada: é sempre calculado aqui. Por enquanto é só o
-- saldo inicial; as fatias de lançamentos e de transferências estendem esta view.
-- security_invoker: a view respeita o RLS de quem consulta, e não o do dono dela.
create view public.accounts_with_balance
with (security_invoker = true) as
select
  a.id,
  a.user_id,
  a.name,
  a.type,
  a.initial_balance,
  a.initial_balance_date,
  a.color,
  a.icon,
  a.archived,
  a.created_at,
  a.initial_balance as current_balance
from public.accounts a;

revoke all on public.accounts_with_balance from anon;
grant select on public.accounts_with_balance to authenticated;
