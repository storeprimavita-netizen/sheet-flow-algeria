-- ============================================================================
-- STORE-1 (D54): options, values and variants per product.
-- Replaces products.variants (jsonb, kept) and free-text orders.variant (kept as a label snapshot).
-- Per-size stock starts at 0 (nothing invented); products.stock stays the total.
-- No cost field anywhere: agents may read, only admins write.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) tables. Every child carries product_id so composite FKs keep the whole
--    tree inside ONE product and ONE workspace.
-- ---------------------------------------------------------------------------
create table public.product_options (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id   uuid not null,
  name         text not null check (btrim(name) <> ''),
  position     integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, product_id),
  foreign key (product_id, workspace_id) references public.products (id, workspace_id) on delete cascade
);
create index product_options_product_idx on public.product_options (product_id);

create table public.product_option_values (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id   uuid not null,
  option_id    uuid not null,
  label        text not null check (btrim(label) <> ''),
  position     integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, product_id, option_id),
  foreign key (option_id, product_id) references public.product_options (id, product_id) on delete cascade,
  foreign key (product_id, workspace_id) references public.products (id, workspace_id) on delete cascade
);
create index product_option_values_option_idx on public.product_option_values (option_id);
-- the same label twice in one option is a duplicate value
create unique index product_option_values_label_uniq
  on public.product_option_values (option_id, lower(btrim(label)));

create table public.product_variants (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id   uuid not null,
  sku          text,
  is_active    boolean not null default true,
  stock        integer not null default 0,   -- changes only through a stock movement; may go below 0 (D54.3)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, product_id),
  foreign key (product_id, workspace_id) references public.products (id, workspace_id) on delete cascade
);
create index product_variants_product_idx on public.product_variants (product_id);

create table public.product_variant_values (
  variant_id   uuid not null,
  option_id    uuid not null,
  value_id     uuid not null,
  product_id   uuid not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  primary key (variant_id, option_id),          -- one value per option
  foreign key (variant_id, product_id) references public.product_variants (id, product_id) on delete cascade,
  -- NO ACTION: a value used by a variant cannot be deleted on its own (a product delete cascades both)
  foreign key (value_id, product_id, option_id) references public.product_option_values (id, product_id, option_id),
  foreign key (product_id, workspace_id) references public.products (id, workspace_id) on delete cascade
);
create index product_variant_values_value_idx on public.product_variant_values (value_id);

-- ---------------------------------------------------------------------------
-- 2) triggers
-- ---------------------------------------------------------------------------
create or replace function public.product_id_immutable()
returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if new.product_id is distinct from old.product_id then
    raise exception 'product_id cannot change';
  end if;
  return new;
end; $$;

do $$
declare t text;
begin
  foreach t in array array['product_options','product_option_values','product_variants','product_variant_values'] loop
    execute format('create trigger product_id_immutable before update on public.%I '
                   'for each row execute function public.product_id_immutable();', t);
  end loop;
  foreach t in array array['product_options','product_option_values','product_variants'] loop
    execute format('create trigger set_updated_at before update on public.%I '
                   'for each row execute function public.set_updated_at();', t);
  end loop;
  -- audit options and values only (config); variants carry stock, which has its own log
  foreach t in array array['product_options','product_option_values'] loop
    execute format('create trigger audit after insert or update or delete on public.%I '
                   'for each row execute function public.audit_row();', t);
  end loop;
end; $$;

-- a variant starts at 0 and its stock changes only through a stock movement (apply_stock_movement
-- runs the update one trigger level deeper, exactly as products_stock_guard)
create or replace function public.product_variants_stock_guard()
returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    if new.stock <> 0 then raise exception 'a new variant starts at stock 0'; end if;
  elsif new.stock is distinct from old.stock and pg_trigger_depth() < 2 then
    raise exception 'variant stock changes only through a stock movement';
  end if;
  return new;
end; $$;
create trigger product_variants_stock_guard
  before insert or update of stock on public.product_variants
  for each row execute function public.product_variants_stock_guard();

-- two variants of one product cannot have the same set of values. Deferred, so the
-- rows of one variant can be inserted one by one inside a transaction.
create or replace function public.product_variant_values_unique_set()
returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare
  v uuid := coalesce(new.variant_id, old.variant_id);
  v_product uuid;
  v_sig uuid[];
begin
  select product_id into v_product from public.product_variants where id = v;
  if v_product is null then return null; end if;   -- variant gone (cascade)
  select array_agg(value_id order by value_id) into v_sig from public.product_variant_values where variant_id = v;
  if v_sig is null then return null; end if;
  if exists (
    select 1 from public.product_variants o
    where o.product_id = v_product and o.id <> v
      and (select array_agg(x.value_id order by x.value_id) from public.product_variant_values x where x.variant_id = o.id) = v_sig
  ) then
    raise exception 'another variant of this product already has these values';
  end if;
  return null;
end; $$;
create constraint trigger product_variant_values_unique_set
  after insert or update or delete on public.product_variant_values
  deferrable initially deferred
  for each row execute function public.product_variant_values_unique_set();

-- ---------------------------------------------------------------------------
-- 3) RLS: every role of the workspace reads, only admins write; no anon grant
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['product_options','product_option_values','product_variants','product_variant_values'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format($p$create policy %1$s_sel on public.%1$I for select to authenticated
      using (workspace_id = (select public.current_workspace_id()))$p$, t);
    execute format($p$create policy %1$s_ins on public.%1$I for insert to authenticated
      with check (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()))$p$, t);
    execute format($p$create policy %1$s_upd on public.%1$I for update to authenticated
      using (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()))
      with check (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()))$p$, t);
    execute format($p$create policy %1$s_del on public.%1$I for delete to authenticated
      using (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()))$p$, t);
  end loop;
end; $$;

-- ---------------------------------------------------------------------------
-- 4) not assigned = total - every variant (inactive included). Computed, never stored.
--    count_needed: some variant is below 0, or not assigned is not 0 (only for products with variants).
-- ---------------------------------------------------------------------------
create or replace view public.product_variant_stock_v with (security_invoker = true) as
select p.id as product_id,
       p.workspace_id,
       p.stock as total,
       count(v.id)::integer as variant_count,
       coalesce(sum(v.stock), 0)::integer as variants_total,
       (p.stock - coalesce(sum(v.stock), 0))::integer as not_assigned,
       (count(v.id) > 0 and (coalesce(bool_or(v.stock < 0), false) or p.stock - coalesce(sum(v.stock), 0) <> 0)) as count_needed
from public.products p
left join public.product_variants v on v.product_id = p.id
group by p.id, p.workspace_id, p.stock;
revoke all on public.product_variant_stock_v from anon;
revoke insert, update, delete, truncate on public.product_variant_stock_v from authenticated, service_role;
grant select on public.product_variant_stock_v to authenticated;
