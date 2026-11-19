-- VAR-1 (D76, replaces D55's "option set is fixed once sizes exist"): (1) an option can be added to a product that
-- already has sizes, with a backfill value every existing size gets; (2) colour options with a swatch per value
-- (hex or https photo URL); (3) size_sets, reusable lists of size names (admin only).

-- ---------------------------------------------------------------------------
-- 1) kind + swatches
-- ---------------------------------------------------------------------------
alter table public.product_options
  add column kind text not null default 'text' check (kind in ('text', 'color'));
create unique index product_options_one_color on public.product_options (product_id) where kind = 'color';

alter table public.product_option_values
  add column swatch_color text check (swatch_color ~ '^#[0-9a-fA-F]{6}$'),
  add column swatch_image text check (swatch_image ~ '^https://[^\s"''()<>\\]+$' and char_length(swatch_image) <= 2048),
  add constraint product_option_values_one_swatch check (swatch_color is null or swatch_image is null);

-- a swatch lives only on a value of a colour option
create or replace function public.product_option_values_swatch_check()
returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if (new.swatch_color is not null or new.swatch_image is not null)
     and not exists (select 1 from public.product_options o where o.id = new.option_id and o.kind = 'color') then
    raise exception 'swatch needs a color option';
  end if;
  return new;
end; $$;
revoke all on function public.product_option_values_swatch_check() from public, anon, authenticated;
create trigger swatch_check before insert or update on public.product_option_values
  for each row execute function public.product_option_values_swatch_check();

-- kind turned back to text: swatches are cleared
create or replace function public.product_options_kind_clear()
returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if new.kind = 'text' and old.kind = 'color' then
    update public.product_option_values set swatch_color = null, swatch_image = null where option_id = new.id;
  end if;
  return null;
end; $$;
revoke all on function public.product_options_kind_clear() from public, anon, authenticated;
create trigger kind_clear after update of kind on public.product_options
  for each row execute function public.product_options_kind_clear();

-- ---------------------------------------------------------------------------
-- 2) size_sets (pattern of 00061_seasons.sql)
-- ---------------------------------------------------------------------------
create or replace function public.size_set_items_ok(p_items text[])
returns boolean
language sql immutable set search_path = pg_catalog as $$
  select p_items is not null
     and cardinality(p_items) between 1 and 40
     and not exists (select 1 from unnest(p_items) i
                      where i is null or i <> btrim(i) or i = '' or char_length(i) > 60);
$$;

create table public.size_sets (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name         text not null check (btrim(name) <> '' and char_length(name) <= 60),
  items        text[] not null check (public.size_set_items_ok(items)),
  position     int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index size_sets_name_uniq on public.size_sets (workspace_id, lower(name));
create index size_sets_workspace_idx on public.size_sets (workspace_id);

create or replace function public.size_sets_workspace_immutable()
returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if new.workspace_id is distinct from old.workspace_id then
    raise exception 'workspace_id cannot change';
  end if;
  return new;
end; $$;
revoke all on function public.size_sets_workspace_immutable() from public, anon, authenticated;

create trigger workspace_immutable before update on public.size_sets
  for each row execute function public.size_sets_workspace_immutable();
create trigger set_updated_at before update on public.size_sets
  for each row execute function public.set_updated_at();
create trigger audit after insert or update or delete on public.size_sets
  for each row execute function public.audit_row();

alter table public.size_sets enable row level security;
revoke all on public.size_sets from anon;
revoke truncate, trigger, references on public.size_sets from authenticated;
create policy size_sets_sel on public.size_sets for select to authenticated
  using (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()));
create policy size_sets_ins on public.size_sets for insert to authenticated
  with check (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()));
create policy size_sets_upd on public.size_sets for update to authenticated
  using (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()))
  with check (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()));
create policy size_sets_del on public.size_sets for delete to authenticated
  using (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- 3) save_variant_config. p_config = { options: [{id,name,kind,values:[{id,label,swatch_color,swatch_image}]}],
--    variants: [{id,sku,is_active,values:{optionId:valueId}}], backfill: {newOptionId: valueId} }
--    RULES: an existing option missing from the payload while the product has sizes = 'stale'; a new option on a
--    product whose sizes have values needs a backfill value of that option = else 'incomplete size'.
--    SECURITY INVOKER on purpose: under definer the 'authenticated' completeness rule (00067) would switch off.
-- ---------------------------------------------------------------------------
create or replace function public.save_variant_config(p_product uuid, p_config jsonb)
returns void
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_ws uuid;
  v_opts jsonb := coalesce(p_config->'options', '[]'::jsonb);
  v_vars jsonb := coalesce(p_config->'variants', '[]'::jsonb);
  v_back jsonb := coalesce(p_config->'backfill', '{}'::jsonb);
  v_pre uuid[];
begin
  -- same key as the duplicate-set trigger: two saves of one product queue up
  perform pg_advisory_xact_lock(hashtext(p_product::text));

  select workspace_id into v_ws from public.products where id = p_product;
  if v_ws is null or v_ws <> (select public.current_workspace_id()) or not (select public.is_admin()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  -- an existing option may not vanish from a product that has sizes (a stale tab); without sizes removal is free
  if exists (select 1 from public.product_variants where product_id = p_product)
     and exists (select 1 from public.product_options po
                 where po.product_id = p_product
                   and not exists (select 1 from jsonb_array_elements(v_opts) as a(o) where a.o->>'id' = po.id::text)) then
    raise exception 'stale';
  end if;

  -- an id that already lives under another product (or option) is refused; other workspaces are invisible
  -- to RLS and end in a key violation
  if exists (select 1 from jsonb_array_elements(v_opts) as a(o)
             join public.product_options po on po.id = (a.o->>'id')::uuid where po.product_id <> p_product)
     or exists (select 1 from jsonb_array_elements(v_opts) as a(o), lateral jsonb_array_elements(a.o->'values') as t(v)
                join public.product_option_values pv on pv.id = (t.v->>'id')::uuid
                where pv.product_id <> p_product or pv.option_id <> (a.o->>'id')::uuid)
     or exists (select 1 from jsonb_array_elements(v_vars) as a(v)
                join public.product_variants pv on pv.id = (a.v->>'id')::uuid where pv.product_id <> p_product) then
    raise exception 'id belongs to another product';
  end if;

  -- sizes that exist now and have values: only they are backfilled (snapshot before the variant upsert)
  select coalesce(array_agg(distinct x.variant_id), '{}') into v_pre
  from public.product_variant_values x where x.product_id = p_product;

  -- backfill: an object, keyed by NEW payload option ids only, each value a payload value of that same option
  if jsonb_typeof(v_back) is distinct from 'object' then
    raise exception 'incomplete size';
  end if;
  if exists (
    select 1 from jsonb_each(v_back) kv
    where jsonb_typeof(kv.value) is distinct from 'string'
       or not exists (select 1 from jsonb_array_elements(v_opts) as a(o)
                      where a.o->>'id' = kv.key
                        and not exists (select 1 from public.product_options po where po.id::text = kv.key and po.product_id = p_product)
                        and exists (select 1 from jsonb_array_elements(a.o->'values') as t(v) where t.v->>'id' = kv.value #>> '{}'))
  ) then
    raise exception 'incomplete size';
  end if;
  -- every new option needs its backfill value while sizes with values exist
  if cardinality(v_pre) > 0 and exists (
    select 1 from jsonb_array_elements(v_opts) as a(o)
    where not exists (select 1 from public.product_options po where po.id::text = a.o->>'id' and po.product_id = p_product)
      and not (v_back ? (a.o->>'id'))
  ) then
    raise exception 'incomplete size';
  end if;

  -- park the labels that change, so two labels can be swapped in one save
  update public.product_option_values pv set label = 'parked:' || pv.id::text
  from (select (t.v->>'id')::uuid as id, t.v->>'label' as label
        from jsonb_array_elements(v_opts) as a(o), lateral jsonb_array_elements(a.o->'values') as t(v)) n
  where pv.id = n.id and pv.product_id = p_product and pv.label is distinct from n.label;

  -- drop what the payload no longer has; a value or option still used by a size refuses the whole save
  delete from public.product_option_values
  where product_id = p_product
    and id not in (select (t.v->>'id')::uuid
                   from jsonb_array_elements(v_opts) as a(o), lateral jsonb_array_elements(a.o->'values') as t(v));
  delete from public.product_options
  where product_id = p_product
    and id not in (select (a.o->>'id')::uuid from jsonb_array_elements(v_opts) as a(o));

  -- a new size needs exactly one value per option of the payload, and only payload options
  if exists (
    select 1 from jsonb_array_elements(v_vars) as a(v)
    where not exists (select 1 from public.product_variants x where x.id = (a.v->>'id')::uuid)
      and (
        jsonb_array_length(v_opts) = 0
        or jsonb_typeof(a.v->'values') is distinct from 'object'
        or (select count(*) from jsonb_object_keys(a.v->'values')) <> jsonb_array_length(v_opts)
        or exists (select 1 from jsonb_each_text(a.v->'values') kv
                   where not exists (select 1 from jsonb_array_elements(v_opts) as o(o)
                                     where o.o->>'id' = kv.key
                                       and exists (select 1 from jsonb_array_elements(o.o->'values') as t(v) where t.v->>'id' = kv.value)))
      )
  ) then
    raise exception 'incomplete size';
  end if;

  insert into public.product_options (id, workspace_id, product_id, name, position, kind)
  select (a.o->>'id')::uuid, v_ws, p_product, a.o->>'name', (a.ord - 1)::integer, coalesce(a.o->>'kind', 'text')
  from jsonb_array_elements(v_opts) with ordinality as a(o, ord)
  on conflict (id) do update set name = excluded.name, position = excluded.position, kind = excluded.kind;

  insert into public.product_option_values (id, workspace_id, product_id, option_id, label, position, swatch_color, swatch_image)
  select (t.v->>'id')::uuid, v_ws, p_product, (a.o->>'id')::uuid, t.v->>'label', (t.vord - 1)::integer,
         nullif(t.v->>'swatch_color', ''), nullif(t.v->>'swatch_image', '')
  from jsonb_array_elements(v_opts) as a(o), lateral jsonb_array_elements(a.o->'values') with ordinality as t(v, vord)
  on conflict (id) do update set label = excluded.label, position = excluded.position,
    swatch_color = excluded.swatch_color, swatch_image = excluded.swatch_image;

  -- a new size starts at 0; an existing size only gets sku and is_active
  insert into public.product_variants (id, workspace_id, product_id, sku, is_active)
  select (a.v->>'id')::uuid, v_ws, p_product, nullif(btrim(a.v->>'sku'), ''), coalesce((a.v->>'is_active')::boolean, true)
  from jsonb_array_elements(v_vars) as a(v)
  on conflict (id) do update set sku = excluded.sku, is_active = excluded.is_active;

  -- value rows only for sizes that have none: a size's values never change
  insert into public.product_variant_values (variant_id, option_id, value_id, product_id, workspace_id)
  select (a.v->>'id')::uuid, kv.key::uuid, kv.value::uuid, p_product, v_ws
  from jsonb_array_elements(v_vars) as a(v), lateral jsonb_each_text(a.v->'values') as kv
  where not exists (select 1 from public.product_variant_values x where x.variant_id = (a.v->>'id')::uuid)
    and not ((a.v->>'id')::uuid = any (v_pre));

  -- backfill: every size that had values gets the chosen value of each new option
  insert into public.product_variant_values (variant_id, option_id, value_id, product_id, workspace_id)
  select pv.id, kv.key::uuid, (kv.value #>> '{}')::uuid, p_product, v_ws
  from public.product_variants pv, jsonb_each(v_back) kv
  where pv.id = any (v_pre)
    and not exists (select 1 from public.product_variant_values x where x.variant_id = pv.id and x.option_id = kv.key::uuid);
end; $$;

revoke all on function public.save_variant_config(uuid, jsonb) from public, anon, service_role;
grant execute on function public.save_variant_config(uuid, jsonb) to authenticated;
