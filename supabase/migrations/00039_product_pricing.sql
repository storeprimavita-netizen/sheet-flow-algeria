-- ============================================================================
-- PRICE-2: per-product pricing overrides, ad costs (USD) and final price.
-- Admin-only financial table. One row per product (absent = all defaults).
-- ============================================================================

-- composite FK target: a product_pricing row can only point at a product of the SAME workspace
alter table public.products add constraint products_id_workspace_uniq unique (id, workspace_id);

create table public.product_pricing (
  product_id    uuid primary key,
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  overrides     jsonb not null default '{}' check (jsonb_typeof(overrides) = 'object'),
  ad_best_usd   numeric(10,2) check (ad_best_usd >= 0),
  ad_medium_usd numeric(10,2) check (ad_medium_usd >= 0),
  ad_worst_usd  numeric(10,2) check (ad_worst_usd >= 0),
  final_price   numeric(12,2) check (final_price > 0),
  updated_at    timestamptz not null default now(),
  foreign key (product_id, workspace_id)
    references public.products (id, workspace_id) on delete cascade
);

create trigger set_updated_at before update on public.product_pricing
  for each row execute function public.set_updated_at();
-- no `id` column: audit_log.row_id is null for this table (accepted)
create trigger audit after insert or update or delete on public.product_pricing
  for each row execute function public.audit_row();

alter table public.product_pricing enable row level security;
create policy product_pricing_adm on public.product_pricing for all to authenticated
  using (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()))
  with check (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()));
