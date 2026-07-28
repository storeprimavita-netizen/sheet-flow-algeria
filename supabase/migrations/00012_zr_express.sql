-- ============================================================================
-- MNW COD ERP v2 — ZR Express delivery-company integration
-- Outbound (we push confirmed orders to ZR Express to create a parcel) +
-- inbound status webhook (ZR notifies us when a parcel's state changes).
-- Reuses integration_configs (provider='zrexpress': config={tenant_id},
-- secret=api_key) for credentials, same as shopify/lightfunnels.
-- ============================================================================

alter type integration_provider add value if not exists 'zrexpress';

-- ---------------------------------------------------------------------------
-- zr_territories — cached wilaya/commune tree from ZR's /territories/search,
-- refreshed by an admin "Sync territories" action. Used to resolve our
-- wilaya_code / free-text commune into ZR's own territory UUIDs at push time.
-- ---------------------------------------------------------------------------
create table public.zr_territories (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  id           uuid not null,          -- ZR's own territory id
  code         int,                    -- official wilaya code when level='wilaya'
  name         text not null,
  level        text not null check (level in ('wilaya', 'commune')),
  parent_id    uuid,                   -- commune's owning wilaya territory id
  synced_at    timestamptz not null default now(),
  primary key (workspace_id, id)
);
create index zr_territories_lookup_idx on public.zr_territories (workspace_id, level, parent_id);

-- ---------------------------------------------------------------------------
-- zr_shipments — one row per order pushed to ZR Express.
-- ---------------------------------------------------------------------------
create table public.zr_shipments (
  order_id         uuid primary key references public.orders(id) on delete cascade,
  workspace_id     uuid not null references public.workspaces(id) on delete cascade,
  parcel_id        uuid not null,
  tracking_number  text,
  state            text,
  state_updated_at timestamptz,
  pushed_at        timestamptz not null default now(),
  last_synced_at   timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index zr_shipments_ws_idx on public.zr_shipments (workspace_id);

create trigger set_updated_at before update on public.zr_shipments
  for each row execute function public.set_updated_at();
create trigger audit after insert or update or delete on public.zr_shipments
  for each row execute function public.audit_row();

-- ---------------------------------------------------------------------------
-- RLS. zr_territories is internal matching data — admin-only end to end.
-- zr_shipments carries a tracking number agents legitimately need to answer
-- customers (same "readable by all, admin writes" shape as wilaya_fees) —
-- writes always go through a server action gated on admin anyway (it needs
-- the ZR API secret, which agents can't read).
-- ---------------------------------------------------------------------------
alter table public.zr_territories enable row level security;
alter table public.zr_shipments   enable row level security;

create policy zrt_adm on public.zr_territories for all to authenticated
  using (workspace_id = public.current_workspace_id() and public.is_admin())
  with check (workspace_id = public.current_workspace_id() and public.is_admin());

create policy zrs_sel on public.zr_shipments for select to authenticated
  using (workspace_id = public.current_workspace_id());
create policy zrs_all on public.zr_shipments for all to authenticated
  using (workspace_id = public.current_workspace_id() and public.is_admin())
  with check (workspace_id = public.current_workspace_id() and public.is_admin());
