-- ============================================================================
-- MNW COD ERP v2 — settings, wilayas & fees, fixed fees, FX, integrations
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) wilayas  (static national reference — no workspace, read-only)
-- ---------------------------------------------------------------------------
create table public.wilayas (
  code smallint primary key check (code between 1 and 58),
  name text not null
);

alter table public.wilayas enable row level security;
create policy w_sel on public.wilayas for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 2) wilaya_fees  (per-workspace delivery fees + stop-shipping flag)
-- ---------------------------------------------------------------------------
create table public.wilaya_fees (
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  wilaya_code   smallint not null references public.wilayas(code),
  home_fee      numeric(12,2) not null default 0,
  stopdesk_fee  numeric(12,2) not null default 0,
  stop_shipping boolean not null default false,   -- manual flag; auto flag is computed
  updated_at    timestamptz not null default now(),
  primary key (workspace_id, wilaya_code)
);

-- ---------------------------------------------------------------------------
-- 3) settings  (per-workspace key/value jsonb)
--    Known keys (documented in docs/DB.md §settings):
--      'return_fee'            → {"amount": 100}                          (DZD)
--      'duplicate_window'      → {"hours": 48}
--      'risk_weights'          → {"returned": 2, "cancelled": 1, "no_answer": 0.5}
--      'stop_shipping_rule'    → {"min_orders": 10, "min_delivery_rate": 40}
--      'meeting_schedule'      → {"slots": [{"dow": 1, "time": "20:00"}, ...]}
-- ---------------------------------------------------------------------------
create table public.settings (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  key          text not null,
  value        jsonb not null,
  updated_at   timestamptz not null default now(),
  primary key (workspace_id, key)
);

-- ---------------------------------------------------------------------------
-- 4) fixed_fees  (monthly fixed costs — feed pricing engine + product P&L)
-- ---------------------------------------------------------------------------
create table public.fixed_fees (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  label        text not null,
  amount       numeric(12,2) not null check (amount >= 0),
  currency     currency_code not null default 'DZD',
  fx_rate      numeric(12,4) not null default 1,          -- rate used at entry
  amount_dzd   numeric(12,2) generated always as (amount * fx_rate) stored,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index fixed_fees_ws_idx on public.fixed_fees (workspace_id) where is_active;

-- ---------------------------------------------------------------------------
-- 5) exchange_rates  (manual, date-stamped; latest row per currency = current)
-- ---------------------------------------------------------------------------
create table public.exchange_rates (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  currency     currency_code not null check (currency in ('USD','EUR')),
  rate_dzd     numeric(12,4) not null check (rate_dzd > 0),
  valid_from   date not null default current_date,
  created_at   timestamptz not null default now()
);
create index exchange_rates_lookup_idx
  on public.exchange_rates (workspace_id, currency, valid_from desc);

create or replace function public.current_fx_rate(p_ws uuid, p_currency currency_code)
returns numeric
language sql stable set search_path = public as $$
  select case when p_currency = 'DZD' then 1 else (
    select rate_dzd from public.exchange_rates
    where workspace_id = p_ws and currency = p_currency
    order by valid_from desc, created_at desc limit 1
  ) end;
$$;

-- ---------------------------------------------------------------------------
-- 6) integration_configs  (Shopify / LightFunnels)
-- ---------------------------------------------------------------------------
create table public.integration_configs (
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  provider      integration_provider not null,
  config        jsonb not null default '{}',   -- e.g. {"store_domain": "..."}
  secret        text,                          -- HMAC webhook secret / API key
  is_active     boolean not null default true,
  last_event_at timestamptz,                   -- health indicator
  updated_at    timestamptz not null default now(),
  primary key (workspace_id, provider)
);

-- ---------------------------------------------------------------------------
-- 7) webhook_events  (raw payload store — debugging & replay; service-role writes)
-- ---------------------------------------------------------------------------
create table public.webhook_events (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid references public.workspaces(id) on delete cascade,
  provider      integration_provider not null,
  external_id   text,
  signature_ok  boolean not null default false,
  payload       jsonb not null,
  processed_at  timestamptz,
  error         text,
  created_at    timestamptz not null default now()
);
create index webhook_events_ws_idx on public.webhook_events (workspace_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['wilaya_fees','settings','fixed_fees','integration_configs'] loop
    execute format(
      'create trigger set_updated_at before update on public.%I '
      'for each row execute function public.set_updated_at();', t);
  end loop;
end; $$;

-- ---------------------------------------------------------------------------
-- audit triggers (settings changes must be traceable)
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['wilaya_fees','settings','fixed_fees','exchange_rates','integration_configs'] loop
    execute format(
      'create trigger audit after insert or update or delete on public.%I '
      'for each row execute function public.audit_row();', t);
  end loop;
end; $$;

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- wilaya_fees readable by all roles (agents may quote fees); everything else
-- is financial/config ⇒ admin-only. webhook_events has NO authenticated
-- policies beyond admin read — the service-role client bypasses RLS.
-- ---------------------------------------------------------------------------
alter table public.wilaya_fees         enable row level security;
alter table public.settings            enable row level security;
alter table public.fixed_fees          enable row level security;
alter table public.exchange_rates      enable row level security;
alter table public.integration_configs enable row level security;
alter table public.webhook_events      enable row level security;

create policy wf_sel on public.wilaya_fees for select to authenticated
  using (workspace_id = public.current_workspace_id());
create policy wf_all on public.wilaya_fees for all to authenticated
  using (workspace_id = public.current_workspace_id() and public.is_admin())
  with check (workspace_id = public.current_workspace_id() and public.is_admin());

do $$
declare t text;
begin
  foreach t in array array['settings','fixed_fees','exchange_rates','integration_configs'] loop
    execute format(
      'create policy %1$s_adm on public.%1$I for all to authenticated '
      'using (workspace_id = public.current_workspace_id() and public.is_admin()) '
      'with check (workspace_id = public.current_workspace_id() and public.is_admin());', t);
  end loop;
end; $$;

create policy we_sel on public.webhook_events for select to authenticated
  using (workspace_id = public.current_workspace_id() and public.is_admin());
