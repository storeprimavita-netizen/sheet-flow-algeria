-- Keep historical mismatches readable while checking all new account links.
-- The original simple FKs remain for their ON DELETE SET NULL behavior.
alter table public.expenses add constraint expenses_workspace_account_fkey
  foreign key (workspace_id, account_id) references public.accounts(workspace_id, id) not valid;
alter table public.ad_spend_daily add constraint ad_spend_workspace_account_fkey
  foreign key (workspace_id, account_id) references public.accounts(workspace_id, id) not valid;
create index expenses_account_workspace_idx on public.expenses (account_id, workspace_id)
  where account_id is not null;
create index ad_spend_account_workspace_idx on public.ad_spend_daily (account_id, workspace_id)
  where account_id is not null;

create function private.guard_account_debit()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_account public.accounts;
  v_linked boolean := false;
  v_remap boolean := false;
begin
  if tg_op = 'UPDATE' then
    if row(new.workspace_id, new.account_id, new.amount, new.currency, new.fx_rate, new.spent_on)
        is not distinct from
        row(old.workspace_id, old.account_id, old.amount, old.currency, old.fx_rate, old.spent_on) then
      return new;
    end if;
    if tg_table_name = 'expenses' then
      select exists (select 1 from public.account_entries
        where workspace_id = old.workspace_id and expense_id = old.id) into v_linked;
    else
      select exists (select 1 from public.account_entries
        where workspace_id = old.workspace_id and ad_spend_id = old.id) into v_linked;
    end if;

    -- Guarded migration and remapping code runs as the owner. This exception
    -- permits only the account-link change for a recorded debit.
    v_remap := (v_linked or new.amount = 0) and current_user = 'postgres' and new.account_id is not null
      and row(new.workspace_id, new.amount, new.currency, new.fx_rate, new.spent_on)
          is not distinct from row(old.workspace_id, old.amount, old.currency, old.fx_rate, old.spent_on);
    if v_linked and not v_remap then
      raise exception 'A recorded ledger debit must be corrected through the ledger' using errcode = '23514';
    end if;
  end if;

  if new.account_id is null then
    return new;
  end if;

  select * into v_account from public.accounts
  where workspace_id = new.workspace_id and id = new.account_id and not legacy_posted
  for share;
  if not found then
    raise exception 'Account is unavailable in this workspace' using errcode = '23503';
  end if;
  if not (new.currency = v_account.currency or v_remap
    or (v_account.kind is not null and v_account.currency = 'DZD' and new.fx_rate > 0 and new.fx_rate < 100000000)) then
    raise exception 'The debit currency does not match the selected account' using errcode = '23514';
  end if;
  if not (new.amount >= 0 and new.amount < 100000000000000) then
    raise exception 'The account debit must have a finite amount' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_account_debit() from public, anon, authenticated, service_role;
create trigger expenses_guard_account_debit before insert or update on public.expenses
  for each row execute function private.guard_account_debit();
create trigger ad_spend_guard_account_debit before insert or update on public.ad_spend_daily
  for each row execute function private.guard_account_debit();

create or replace view public.account_balances with (security_invoker = true) as
select
  a.id as account_id,
  a.workspace_id,
  a.name,
  a.currency,
  a.opening_balance,
  a.low_balance_threshold,
  a.is_active,
  a.opening_balance
    + case when a.kind is null then coalesce((
        select sum(t.amount) from public.account_topups t
        where t.account_id = a.id and t.workspace_id = a.workspace_id
      ), 0) else 0 end
    + coalesce((
        select sum(case l.direction when 'in' then l.amount else -l.amount end)
        from public.account_entries l where l.account_id = a.id and l.workspace_id = a.workspace_id
      ), 0)
    - coalesce((
        select sum(case when a.kind is null or e.currency = a.currency then e.amount else e.amount_dzd end)
        from public.expenses e
        where e.account_id = a.id and e.workspace_id = a.workspace_id
          and not exists (select 1 from public.account_entries l
            where l.workspace_id = a.workspace_id and l.expense_id = e.id)
      ), 0)
    - coalesce((
        select sum(case when a.kind is null or s.currency = a.currency then s.amount else s.amount_dzd end)
        from public.ad_spend_daily s
        where s.account_id = a.id and s.workspace_id = a.workspace_id
          and not exists (select 1 from public.account_entries l
            where l.workspace_id = a.workspace_id and l.ad_spend_id = s.id)
      ), 0)
  as balance
from public.accounts a
where not a.legacy_posted;
revoke all on public.account_balances from public, anon;
grant select on public.account_balances to authenticated;
