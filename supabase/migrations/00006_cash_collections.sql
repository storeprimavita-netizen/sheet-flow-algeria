-- ============================================================================
-- MNW COD ERP — cash_collections (Phase 9: cash reconciliation)
-- File: supabase/migrations/00006_cash_collections.sql
--
-- COD = physical cash. When an order is delivered, cash is collected (by a
-- courier/bureau/agent); it's later handed to the accountant and banked.
-- This table tracks each delivered order's collected cash from "held" to
-- "deposited". One row per order. Admin-only (financial data).
-- ============================================================================

create table if not exists public.cash_collections (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders(id) on delete cascade,
  amount            numeric(12,2) not null check (amount >= 0),
  collected_by      text,
  collected_at      timestamptz not null default now(),
  status            text not null default 'held' check (status in ('held','deposited')),
  deposit_reference text,
  deposited_at      timestamptz,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (order_id)
);

create index if not exists cash_collections_status_idx        on public.cash_collections (status);
create index if not exists cash_collections_deposited_at_idx  on public.cash_collections (deposited_at);

alter table public.cash_collections enable row level security;

drop policy if exists cc_sel on public.cash_collections;
drop policy if exists cc_ins on public.cash_collections;
drop policy if exists cc_upd on public.cash_collections;
drop policy if exists cc_del on public.cash_collections;

-- financial data: admin-only
create policy cc_sel on public.cash_collections for select to authenticated using (public.is_admin());
create policy cc_ins on public.cash_collections for insert to authenticated with check (public.is_admin());
create policy cc_upd on public.cash_collections for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy cc_del on public.cash_collections for delete to authenticated using (public.is_admin());

drop trigger if exists set_updated_at on public.cash_collections;
create trigger set_updated_at
  before update on public.cash_collections
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- cash_summary(): outstanding / deposited-this-month / collected-this-month
-- (security invoker → RLS applies; admin-only in practice)
-- ----------------------------------------------------------------------------
create or replace function public.cash_summary()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'outstanding',     coalesce((select sum(amount) from public.cash_collections where status='held'), 0),
    'deposited_month', coalesce((select sum(amount) from public.cash_collections
                                  where status='deposited' and deposited_at >= date_trunc('month', now())), 0),
    'collected_month', coalesce((select sum(amount) from public.cash_collections
                                  where collected_at >= date_trunc('month', now())), 0)
  );
$$;

grant execute on function public.cash_summary() to authenticated;
