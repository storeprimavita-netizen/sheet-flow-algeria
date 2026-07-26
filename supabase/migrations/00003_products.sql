-- ============================================================================
-- MNW COD ERP v2 — products, costs (admin-only), scenarios, expenses,
--                  ad spend, stock, suppliers
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) products  (NON-financial columns only — agents may read via order joins)
--    Financial data lives in product_costs / expenses / ad_spend_daily, which
--    are admin-only. This split is what enforces "agents never see costs" at
--    the RLS level (RLS is row-based; column secrecy needs a second table).
-- ---------------------------------------------------------------------------
create table public.products (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  sku          text,
  name         text not null,
  category     text,
  fabric       text,                          -- tissu
  status       product_status not null default 'to_be_tested',
  sale_price   numeric(12,2),                 -- what the customer pays — agents may see
  variants     jsonb not null default '[]',   -- [{"label":"M / red", "sku":"..."}]
  images       text[] not null default '{}',
  stock        integer not null default 0,    -- maintained by stock_movements trigger
  notes        text,
  is_active    boolean not null default true,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (workspace_id, sku)
);
create index products_ws_status_idx on public.products (workspace_id, status);

-- ---------------------------------------------------------------------------
-- 2) product_costs  (1:1 admin-only financial extension)
-- ---------------------------------------------------------------------------
create table public.product_costs (
  product_id        uuid primary key references public.products(id) on delete cascade,
  workspace_id      uuid not null references public.workspaces(id) on delete cascade,
  sourcing_cost     numeric(12,2) not null default 0,
  sourcing_currency currency_code not null default 'DZD',
  fx_rate           numeric(12,4) not null default 1,
  sourcing_cost_dzd numeric(12,2) generated always as (sourcing_cost * fx_rate) stored,
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3) product_scenarios  (BENZ pricing model — best/medium/worst, editable;
--    the read-only "Real" column is computed, never stored)
-- ---------------------------------------------------------------------------
create table public.product_scenarios (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id   uuid references public.products(id) on delete cascade,  -- null = general planner
  slug         text not null check (slug in ('best','medium','worst')),
  inputs       jsonb not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index product_scenarios_general_uniq
  on public.product_scenarios (workspace_id, slug) where product_id is null;
create unique index product_scenarios_product_uniq
  on public.product_scenarios (product_id, slug) where product_id is not null;

-- ---------------------------------------------------------------------------
-- 4) expenses  (multi-currency, converted DZD stored with the rate used)
-- ---------------------------------------------------------------------------
create table public.expenses (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id   uuid references public.products(id) on delete set null,
  contact_id   uuid,                          -- FK added in 00004 (suppliers)
  category     expense_category not null,
  amount       numeric(12,2) not null check (amount >= 0),
  currency     currency_code not null default 'DZD',
  fx_rate      numeric(12,4) not null default 1,
  amount_dzd   numeric(12,2) generated always as (amount * fx_rate) stored,
  spent_on     date not null default current_date,
  note         text,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index expenses_ws_product_idx on public.expenses (workspace_id, product_id);
create index expenses_ws_date_idx    on public.expenses (workspace_id, spent_on);

-- ---------------------------------------------------------------------------
-- 5) ad_spend_daily  (quick-entry widget; one row per product/day/kind)
-- ---------------------------------------------------------------------------
create table public.ad_spend_daily (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id   uuid not null references public.products(id) on delete cascade,
  spent_on     date not null default current_date,
  kind         ad_kind not null default 'test',
  amount       numeric(12,2) not null check (amount >= 0),
  currency     currency_code not null default 'EUR',
  fx_rate      numeric(12,4) not null default 1,
  amount_dzd   numeric(12,2) generated always as (amount * fx_rate) stored,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (workspace_id, product_id, spent_on, kind)
);

-- ---------------------------------------------------------------------------
-- 6) stock_movements  (audit trail; trigger maintains products.stock)
-- ---------------------------------------------------------------------------
create table public.stock_movements (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id   uuid not null references public.products(id) on delete cascade,
  delta        integer not null check (delta <> 0),
  reason       stock_reason not null,
  order_id     uuid,                          -- FK added in 00004
  note         text,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now()
);
create index stock_movements_product_idx on public.stock_movements (product_id, created_at desc);

create or replace function public.apply_stock_movement()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.products set stock = stock + new.delta where id = new.product_id;
  return new;
end; $$;

create trigger stock_movements_apply
  after insert on public.stock_movements
  for each row execute function public.apply_stock_movement();

-- ---------------------------------------------------------------------------
-- updated_at + audit triggers
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['products','product_costs','product_scenarios','expenses','ad_spend_daily'] loop
    execute format(
      'create trigger set_updated_at before update on public.%I '
      'for each row execute function public.set_updated_at();', t);
  end loop;
end; $$;

create trigger audit after insert or update or delete on public.expenses
  for each row execute function public.audit_row();
create trigger audit after insert or update or delete on public.product_costs
  for each row execute function public.audit_row();

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
--   products: workspace read for ALL roles (agents need names/images through
--             order joins), admin writes.
--   everything financial: admin-only.
-- ---------------------------------------------------------------------------
alter table public.products          enable row level security;
alter table public.product_costs     enable row level security;
alter table public.product_scenarios enable row level security;
alter table public.expenses          enable row level security;
alter table public.ad_spend_daily    enable row level security;
alter table public.stock_movements   enable row level security;

create policy p_sel on public.products for select to authenticated
  using (workspace_id = public.current_workspace_id());
create policy p_all on public.products for all to authenticated
  using (workspace_id = public.current_workspace_id() and public.is_admin())
  with check (workspace_id = public.current_workspace_id() and public.is_admin());

do $$
declare t text;
begin
  foreach t in array array['product_costs','product_scenarios','expenses','ad_spend_daily','stock_movements'] loop
    execute format(
      'create policy %1$s_adm on public.%1$I for all to authenticated '
      'using (workspace_id = public.current_workspace_id() and public.is_admin()) '
      'with check (workspace_id = public.current_workspace_id() and public.is_admin());', t);
  end loop;
end; $$;
