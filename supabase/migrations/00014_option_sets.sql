-- ============================================================================
-- MNW COD ERP v2 — option sets (Notion-style user-editable taxonomies)
-- See .claude/skills/cod-ui-polish/references/option-sets.md for the design.
--
-- Fixed Postgres enums (confirmation/delivery/product/task status,
-- supplier_type, expense_category, order_source) are NOT touched here —
-- decision + rationale in PROGRESS.md's Phase 12 §9 block. This migration
-- only covers taxonomies the team actually grows over time: product
-- category, fabric/tissu, expense subcategory, order tags, cancellation
-- reason — the ones that were either free text or didn't exist yet.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) option_sets / options
-- ---------------------------------------------------------------------------
create table public.option_sets (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  key          text not null,
  label        text not null,          -- English fallback; UI prefers optionSets.sets.<key> i18n key
  allows_multi boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (workspace_id, key)
);

create table public.options (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  set_id       uuid not null references public.option_sets(id) on delete cascade,
  label        text not null,
  color_token  text not null default 'neutral',
  icon         text,
  sort_order   integer not null default 0,
  archived_at  timestamptz,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index options_set_idx on public.options (set_id, sort_order);

create trigger set_updated_at before update on public.options
  for each row execute function public.set_updated_at();

create trigger audit after insert or update or delete on public.option_sets
  for each row execute function public.audit_row();
create trigger audit after insert or update or delete on public.options
  for each row execute function public.audit_row();

alter table public.option_sets enable row level security;
alter table public.options     enable row level security;

-- sets: everyone in the workspace can read (needed to render selects); only
-- admins manage the sets themselves (this app ships a fixed 5 sets, no UI to
-- create a brand-new set is offered this phase).
create policy os_sel on public.option_sets for select to authenticated
  using (workspace_id = public.current_workspace_id());
create policy os_adm on public.option_sets for all to authenticated
  using (workspace_id = public.current_workspace_id() and public.is_admin())
  with check (workspace_id = public.current_workspace_id() and public.is_admin());

-- options: everyone reads + may INSERT (the "+ Create" inline affordance is
-- for any role — a confirmation agent cancelling an order needs to be able
-- to type a new cancellation reason without asking an admin first). Rename/
-- recolor/reorder/archive/merge/delete are admin-only (update+delete).
create policy o_sel on public.options for select to authenticated
  using (workspace_id = public.current_workspace_id());
create policy o_ins on public.options for insert to authenticated
  with check (workspace_id = public.current_workspace_id());
create policy o_upd on public.options for update to authenticated
  using (workspace_id = public.current_workspace_id() and public.is_admin())
  with check (workspace_id = public.current_workspace_id() and public.is_admin());
create policy o_del on public.options for delete to authenticated
  using (workspace_id = public.current_workspace_id() and public.is_admin());

-- ---------------------------------------------------------------------------
-- 2) wire referencing columns
-- ---------------------------------------------------------------------------

-- products.category/fabric were free text with no picker — replace with FKs.
alter table public.products add column category_option_id uuid references public.options(id) on delete set null;
alter table public.products add column fabric_option_id   uuid references public.options(id) on delete set null;
alter table public.products drop column category;
alter table public.products drop column fabric;

-- expenses: subcategory is new, orthogonal to the existing fixed `category` enum.
alter table public.expenses add column subcategory_option_id uuid references public.options(id) on delete set null;

-- orders: cancellation reason is new (captured when confirmation/delivery status goes cancelled/returned).
alter table public.orders add column cancellation_reason_option_id uuid references public.options(id) on delete set null;

-- order tags: multi-select, own join table (an order can carry several tags).
create table public.order_tags (
  order_id     uuid not null references public.orders(id) on delete cascade,
  option_id    uuid not null references public.options(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (order_id, option_id)
);
create index order_tags_option_idx on public.order_tags (option_id);

alter table public.order_tags enable row level security;
create policy ot_sel on public.order_tags for select to authenticated
  using (workspace_id = public.current_workspace_id());
create policy ot_ins on public.order_tags for insert to authenticated
  with check (workspace_id = public.current_workspace_id());
create policy ot_del on public.order_tags for delete to authenticated
  using (workspace_id = public.current_workspace_id());

-- ---------------------------------------------------------------------------
-- 3) seed_workspace() — append default sets + options (idempotent, matches
--    the pattern already used for wilaya_fees/settings in 00007_seed.sql)
-- ---------------------------------------------------------------------------
create or replace function public.seed_workspace(p_ws uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_set_id uuid;
begin
  insert into public.wilaya_fees (workspace_id, wilaya_code)
  select p_ws, code from public.wilayas
  on conflict do nothing;

  insert into public.settings (workspace_id, key, value) values
    (p_ws, 'return_fee',         '{"amount": 150}'),
    (p_ws, 'duplicate_window',   '{"hours": 48}'),
    (p_ws, 'risk_weights',       '{"returned": 2, "cancelled": 1, "no_answer": 0.5}'),
    (p_ws, 'stop_shipping_rule', '{"min_orders": 10, "min_delivery_rate": 40}'),
    (p_ws, 'meeting_schedule',   '{"slots": [{"dow": 1, "time": "20:00"}, {"dow": 4, "time": "20:00"}]}')
  on conflict do nothing;

  if not exists (select 1 from public.option_sets where workspace_id = p_ws and key = 'product_category') then
    insert into public.option_sets (workspace_id, key, label, allows_multi) values
      (p_ws, 'product_category',   'Product category',  false),
      (p_ws, 'product_fabric',     'Fabric',             false),
      (p_ws, 'expense_subcategory','Expense subcategory',false),
      (p_ws, 'order_tag',          'Tags',               true),
      (p_ws, 'cancellation_reason','Cancellation reason',false);

    select id into v_set_id from public.option_sets where workspace_id = p_ws and key = 'product_category';
    insert into public.options (workspace_id, set_id, label, color_token, sort_order) values
      (p_ws, v_set_id, 'Robes',      'violet', 0),
      (p_ws, v_set_id, 'Ensembles',  'cyan',   1),
      (p_ws, v_set_id, 'Abayas',     'indigo', 2),
      (p_ws, v_set_id, 'Jupes',      'orange', 3),
      (p_ws, v_set_id, 'Vestes',     'rose',   4),
      (p_ws, v_set_id, 'Accessoires','info',   5);

    select id into v_set_id from public.option_sets where workspace_id = p_ws and key = 'product_fabric';
    insert into public.options (workspace_id, set_id, label, color_token, sort_order) values
      (p_ws, v_set_id, 'Soie',      'violet', 0),
      (p_ws, v_set_id, 'Coton',     'cyan',   1),
      (p_ws, v_set_id, 'Crêpe',     'indigo', 2),
      (p_ws, v_set_id, 'Denim',     'orange', 3),
      (p_ws, v_set_id, 'Laine',     'rose',   4),
      (p_ws, v_set_id, 'Satin',     'info',   5),
      (p_ws, v_set_id, 'Mousseline','warning',6);

    select id into v_set_id from public.option_sets where workspace_id = p_ws and key = 'expense_subcategory';
    insert into public.options (workspace_id, set_id, label, color_token, sort_order) values
      (p_ws, v_set_id, 'Location studio',    'violet', 0),
      (p_ws, v_set_id, 'Mannequin',          'cyan',   1),
      (p_ws, v_set_id, 'Transport',          'orange', 2),
      (p_ws, v_set_id, 'Fournitures',        'info',   3),
      (p_ws, v_set_id, 'Autre',              'neutral',4);

    select id into v_set_id from public.option_sets where workspace_id = p_ws and key = 'order_tag';
    insert into public.options (workspace_id, set_id, label, color_token, sort_order) values
      (p_ws, v_set_id, 'VIP',           'success', 0),
      (p_ws, v_set_id, 'Risque élevé',  'danger',  1),
      (p_ws, v_set_id, 'Test',          'warning', 2),
      (p_ws, v_set_id, 'Grossiste',     'indigo',  3);

    select id into v_set_id from public.option_sets where workspace_id = p_ws and key = 'cancellation_reason';
    insert into public.options (workspace_id, set_id, label, color_token, sort_order) values
      (p_ws, v_set_id, 'A changé d''avis',        'neutral', 0),
      (p_ws, v_set_id, 'Trouvé moins cher',       'warning', 1),
      (p_ws, v_set_id, 'Commande en double',      'orange',  2),
      (p_ws, v_set_id, 'Numéro injoignable',      'rose',    3),
      (p_ws, v_set_id, 'Plus besoin',             'neutral', 4),
      (p_ws, v_set_id, 'Autre',                   'neutral', 5);
  end if;
end; $$;
