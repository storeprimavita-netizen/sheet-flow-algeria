-- ============================================================================
-- MNW COD ERP — accounts (running ledger for expense budgets)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) accounts  (admin-only financial — tracks spending budgets)
-- ---------------------------------------------------------------------------
create table public.accounts (
  id                     uuid primary key default gen_random_uuid(),
  workspace_id           uuid not null references public.workspaces(id) on delete cascade,
  name                   text not null,
  currency               currency_code not null default 'DZD',
  opening_balance        numeric(12,2) not null default 0,
  low_balance_threshold  numeric(12,2) not null default 0,
  is_active              boolean not null default true,
  created_by             uuid references auth.users(id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index accounts_ws_idx on public.accounts (workspace_id);

-- ---------------------------------------------------------------------------
-- 2) account_topups  (append-only deposits/recharges)
-- ---------------------------------------------------------------------------
create table public.account_topups (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  account_id   uuid not null references public.accounts(id) on delete cascade,
  amount       numeric(12,2) not null check (amount >= 0),
  occurred_on  date not null default current_date,
  note         text,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now()
);
create index account_topups_account_idx on public.account_topups (account_id, occurred_on desc);

-- ---------------------------------------------------------------------------
-- 3) nullable FK on existing tables (backward-compatible)
-- ---------------------------------------------------------------------------
alter table public.expenses
  add column if not exists account_id uuid references public.accounts(id) on delete set null;
alter table public.ad_spend_daily
  add column if not exists account_id uuid references public.accounts(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 4) Derived balance view (security invoker — caller's RLS applies)
--    Balance = opening_balance + sum(topups) - sum(expenses.amount) - sum(ad_spend.amount)
--    Uses amount (not amount_dzd) because accounts track their own currency.
-- ---------------------------------------------------------------------------
create view public.account_balances as
select
  a.id as account_id,
  a.workspace_id,
  a.name,
  a.currency,
  a.opening_balance,
  a.low_balance_threshold,
  a.is_active,
  coalesce(a.opening_balance, 0)
    + coalesce((select sum(t.amount) from public.account_topups t where t.account_id = a.id), 0)
    - coalesce((select sum(e.amount) from public.expenses e where e.account_id = a.id), 0)
    - coalesce((select sum(s.amount) from public.ad_spend_daily s where s.account_id = a.id), 0)
  as balance
from public.accounts a;

-- ---------------------------------------------------------------------------
-- 5) Triggers
-- ---------------------------------------------------------------------------
create trigger set_updated_at before update on public.accounts
  for each row execute function public.set_updated_at();

create trigger audit_accounts after insert or update or delete on public.accounts
  for each row execute function public.audit_row();
create trigger audit_topups after insert or update or delete on public.account_topups
  for each row execute function public.audit_row();

-- ---------------------------------------------------------------------------
-- 6) RLS: admin-only (financial)
-- ---------------------------------------------------------------------------
alter table public.accounts enable row level security;
alter table public.account_topups enable row level security;

create policy accts_adm on public.accounts for all to authenticated
  using (workspace_id = public.current_workspace_id() and public.is_admin())
  with check (workspace_id = public.current_workspace_id() and public.is_admin());
create policy topups_adm on public.account_topups for all to authenticated
  using (workspace_id = public.current_workspace_id() and public.is_admin())
  with check (workspace_id = public.current_workspace_id() and public.is_admin());
