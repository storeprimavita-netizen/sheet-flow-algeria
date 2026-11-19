-- ============================================================================
-- STORE-3: pricing modes, quantity offers + one bump, order-form fields.
-- Public output is read only through the server-only DAL (service role); no anon grant.
-- No free-delivery column anywhere (D60). No CHECK compare_at vs sale_price: the product
-- save throws raw error messages, so the rule lives in code (compare hidden when <= price).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) price columns
-- ---------------------------------------------------------------------------
alter table public.products
  add column pricing_mode text not null default 'uniform'
    check (pricing_mode in ('uniform','per_value','per_variant')),
  add column compare_at_price numeric(12,2) check (compare_at_price is null or compare_at_price >= 0);

alter table public.product_option_values
  add column price_delta integer not null default 0 check (abs(price_delta) <= 10000000);

alter table public.product_variants
  add column price_override integer check (price_override is null or price_override >= 0),
  add column compare_at_override integer check (compare_at_override is null or compare_at_override >= 0);

-- variants carry no audit trigger (stock has its own log): audit the price columns only
create or replace function public.product_variants_price_audit()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.price_override is distinct from old.price_override
     or new.compare_at_override is distinct from old.compare_at_override then
    insert into public.audit_log(workspace_id, actor, table_name, row_id, action, old_row, new_row)
    values (new.workspace_id, auth.uid(), 'product_variants', new.id::text, 'UPDATE',
            jsonb_build_object('price_override', old.price_override, 'compare_at_override', old.compare_at_override),
            jsonb_build_object('price_override', new.price_override, 'compare_at_override', new.compare_at_override));
  end if;
  return new;
end; $$;
revoke all on function public.product_variants_price_audit() from public, anon, authenticated;
create trigger price_audit after update of price_override, compare_at_override on public.product_variants
  for each row execute function public.product_variants_price_audit();

-- ---------------------------------------------------------------------------
-- 2) product_offers
-- ---------------------------------------------------------------------------
create table public.product_offers (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  product_id      uuid not null,
  kind            text not null check (kind in ('quantity','bump')),
  label           text not null check (btrim(label) <> '' and char_length(label) <= 60),
  qty             integer,
  total_price     integer,
  bump_product_id uuid,
  bump_price      integer,
  is_default      boolean not null default false,
  position        integer not null default 0,
  active_from     timestamptz,
  active_to       timestamptz,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (kind <> 'quantity' or (qty between 2 and 50 and total_price > 0 and bump_product_id is null and bump_price is null)),
  -- a bump whose product was deleted keeps its row with a null product (the store hides it)
  check (kind <> 'bump' or (qty is null and total_price is null and not is_default and bump_price >= 0)),
  check (active_from is null or active_to is null or active_from < active_to),
  foreign key (product_id, workspace_id) references public.products (id, workspace_id) on delete cascade,
  foreign key (bump_product_id, workspace_id) references public.products (id, workspace_id) on delete set null (bump_product_id)
);
create index product_offers_product_idx on public.product_offers (product_id);
create index product_offers_workspace_idx on public.product_offers (workspace_id);
create unique index product_offers_one_default on public.product_offers (product_id) where kind = 'quantity' and is_default;
create unique index product_offers_one_bump on public.product_offers (product_id) where kind = 'bump';

-- bump product: not the product itself, active, priced, and without sizes (workspace is the composite FK)
create or replace function public.product_offers_bump_check()
returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if new.kind = 'bump' and new.bump_product_id is not null then
    if new.bump_product_id = new.product_id then
      raise exception 'a product cannot be its own bump';
    end if;
    if not exists (select 1 from public.products p
                   where p.id = new.bump_product_id and p.is_active and p.sale_price is not null)
       or exists (select 1 from public.product_variants v where v.product_id = new.bump_product_id) then
      raise exception 'bump product must be active, priced and have no sizes';
    end if;
  end if;
  return new;
end; $$;
revoke all on function public.product_offers_bump_check() from public, anon, authenticated;
create trigger bump_check before insert or update on public.product_offers
  for each row execute function public.product_offers_bump_check();

-- ---------------------------------------------------------------------------
-- 3) product_forms
-- ---------------------------------------------------------------------------
create table public.product_forms (
  product_id       uuid primary key,
  workspace_id     uuid not null references public.workspaces(id) on delete cascade,
  fields           jsonb not null default '[]'::jsonb
    check (jsonb_typeof(fields) = 'array' and octet_length(fields::text) < 16000),
  delivery_methods text[] not null default '{home,stopdesk}'
    check (cardinality(delivery_methods) > 0 and delivery_methods <@ array['home','stopdesk']),
  updated_at       timestamptz not null default now(),
  foreign key (product_id, workspace_id) references public.products (id, workspace_id) on delete cascade
);
create index product_forms_workspace_idx on public.product_forms (workspace_id);

-- ---------------------------------------------------------------------------
-- 4) triggers, RLS, grants
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['product_offers','product_forms'] loop
    execute format('create trigger workspace_immutable before update on public.%I '
                   'for each row execute function public.store_workspace_immutable();', t);
    execute format('create trigger product_id_immutable before update on public.%I '
                   'for each row execute function public.product_id_immutable();', t);
    execute format('create trigger set_updated_at before update on public.%I '
                   'for each row execute function public.set_updated_at();', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke truncate, trigger, references on public.%I from authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated '
                   'using (workspace_id = (select public.current_workspace_id()))', t || '_sel', t);
    execute format('create policy %I on public.%I for insert to authenticated '
                   'with check (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()))', t || '_ins', t);
    execute format('create policy %I on public.%I for update to authenticated '
                   'using (workspace_id = (select public.current_workspace_id()) and (select public.is_admin())) '
                   'with check (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()))', t || '_upd', t);
    execute format('create policy %I on public.%I for delete to authenticated '
                   'using (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()))', t || '_del', t);
  end loop;
end; $$;
create trigger audit after insert or update or delete on public.product_offers
  for each row execute function public.audit_row();
-- product_forms has no id column: audit_row() would log a null row id, which is acceptable (pk = product_id in the row JSON)
create trigger audit after insert or update or delete on public.product_forms
  for each row execute function public.audit_row();
