-- ============================================================================
-- MNW COD ERP — pricing_scenarios (BENZ Pricing model)
-- File: supabase/migrations/00004_pricing_scenarios.sql
--
-- Stores the inputs of the BENZ Pricing COD unit-economics model, per scenario
-- (best / medium / worst). A NULL product_id = the general-purpose planner;
-- a set product_id = that product's own 3 scenarios. The 14 numeric inputs live
-- in a single jsonb column; every derived number is computed in the app
-- (src/lib/pricing.ts) to mirror the spreadsheet formulas exactly.
--
-- RLS mirrors products: all authenticated read, admin write.
-- ============================================================================

create table if not exists public.pricing_scenarios (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,  -- null = general
  slug       text not null check (slug in ('best','medium','worst')),
  inputs     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- at most one row per (product, slug); general rows (product_id null) unique per slug
create unique index if not exists pricing_scenarios_product_uniq
  on public.pricing_scenarios (product_id, slug) where product_id is not null;
create unique index if not exists pricing_scenarios_general_uniq
  on public.pricing_scenarios (slug) where product_id is null;

alter table public.pricing_scenarios enable row level security;

drop policy if exists ps_sel on public.pricing_scenarios;
drop policy if exists ps_ins on public.pricing_scenarios;
drop policy if exists ps_upd on public.pricing_scenarios;
drop policy if exists ps_del on public.pricing_scenarios;

-- mirror products: all authenticated read, admin-only writes
create policy ps_sel on public.pricing_scenarios for select to authenticated using (true);
create policy ps_ins on public.pricing_scenarios for insert to authenticated with check (public.is_admin());
create policy ps_upd on public.pricing_scenarios for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy ps_del on public.pricing_scenarios for delete to authenticated using (public.is_admin());

drop trigger if exists set_updated_at on public.pricing_scenarios;
create trigger set_updated_at
  before update on public.pricing_scenarios
  for each row execute function public.set_updated_at();
