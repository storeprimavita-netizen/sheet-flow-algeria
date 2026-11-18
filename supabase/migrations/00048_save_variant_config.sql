-- STORE-1 round 4 (D55): the options-and-sizes save is one transaction, and the database itself
-- refuses a size that lacks a value for one of its product's options.

-- ---------------------------------------------------------------------------
-- 1) deferred check: at commit, every size of the product that has values has exactly one value per option.
--    A size with no values at all is not refused here (tests build a size and its values in two calls).
-- ---------------------------------------------------------------------------
create or replace function public.product_variants_complete_check()
returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare
  v_product uuid := coalesce(new.product_id, old.product_id);
begin
  if exists (
    select 1 from public.product_variants v
    where v.product_id = v_product
      and exists (select 1 from public.product_variant_values x where x.variant_id = v.id)
      and (select count(*) from public.product_variant_values x where x.variant_id = v.id)
          <> (select count(*) from public.product_options o where o.product_id = v_product)
  ) then
    raise exception 'every size needs exactly one value for each option of its product';
  end if;
  return null;
end; $$;
revoke all on function public.product_variants_complete_check() from public, anon, authenticated;

create constraint trigger product_variant_values_complete
  after insert or update or delete on public.product_variant_values
  deferrable initially deferred
  for each row execute function public.product_variants_complete_check();
create constraint trigger product_options_complete
  after insert or delete on public.product_options
  deferrable initially deferred
  for each row execute function public.product_variants_complete_check();

-- ---------------------------------------------------------------------------
-- 2) save_variant_config: security INVOKER (RLS stays the wall: admin, own workspace).
--    p_config = { options: [{id,name,values:[{id,label}]}], variants: [{id,sku,is_active,values:{optionId:valueId}}] }
-- ---------------------------------------------------------------------------
create or replace function public.save_variant_config(p_product uuid, p_config jsonb)
returns void
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_ws uuid;
  v_opts jsonb := coalesce(p_config->'options', '[]'::jsonb);
  v_vars jsonb := coalesce(p_config->'variants', '[]'::jsonb);
begin
  -- same key as the duplicate-set trigger: two saves of one product queue up
  perform pg_advisory_xact_lock(hashtext(p_product::text));

  select workspace_id into v_ws from public.products where id = p_product;
  if v_ws is null or v_ws <> (select public.current_workspace_id()) or not (select public.is_admin()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  -- once a size has values the option set is fixed: none added, none missing
  if exists (select 1 from public.product_variant_values where product_id = p_product)
     and (select coalesce(array_agg(id order by id), '{}') from public.product_options where product_id = p_product)
         is distinct from (select coalesce(array_agg((a.o->>'id')::uuid order by (a.o->>'id')::uuid), '{}')
                           from jsonb_array_elements(v_opts) as a(o)) then
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

  -- park the labels that change, so two labels can be swapped in one save
  update public.product_option_values pv set label = 'parked:' || pv.id::text
  from (select (t.v->>'id')::uuid as id, t.v->>'label' as label
        from jsonb_array_elements(v_opts) as a(o), lateral jsonb_array_elements(a.o->'values') as t(v)) n
  where pv.id = n.id and pv.product_id = p_product and pv.label is distinct from n.label;

  insert into public.product_options (id, workspace_id, product_id, name, position)
  select (a.o->>'id')::uuid, v_ws, p_product, a.o->>'name', (a.ord - 1)::integer
  from jsonb_array_elements(v_opts) with ordinality as a(o, ord)
  on conflict (id) do update set name = excluded.name, position = excluded.position;

  insert into public.product_option_values (id, workspace_id, product_id, option_id, label, position)
  select (t.v->>'id')::uuid, v_ws, p_product, (a.o->>'id')::uuid, t.v->>'label', (t.vord - 1)::integer
  from jsonb_array_elements(v_opts) as a(o), lateral jsonb_array_elements(a.o->'values') with ordinality as t(v, vord)
  on conflict (id) do update set label = excluded.label, position = excluded.position;

  -- a new size starts at 0; an existing size only gets sku and is_active
  insert into public.product_variants (id, workspace_id, product_id, sku, is_active)
  select (a.v->>'id')::uuid, v_ws, p_product, nullif(btrim(a.v->>'sku'), ''), coalesce((a.v->>'is_active')::boolean, true)
  from jsonb_array_elements(v_vars) as a(v)
  on conflict (id) do update set sku = excluded.sku, is_active = excluded.is_active;

  -- value rows only for sizes that have none: a size's values never change
  insert into public.product_variant_values (variant_id, option_id, value_id, product_id, workspace_id)
  select (a.v->>'id')::uuid, kv.key::uuid, kv.value::uuid, p_product, v_ws
  from jsonb_array_elements(v_vars) as a(v), lateral jsonb_each_text(a.v->'values') as kv
  where not exists (select 1 from public.product_variant_values x where x.variant_id = (a.v->>'id')::uuid);

  -- drop what the payload no longer has; a value or option still used by a size refuses the whole save
  delete from public.product_option_values
  where product_id = p_product
    and id not in (select (t.v->>'id')::uuid
                   from jsonb_array_elements(v_opts) as a(o), lateral jsonb_array_elements(a.o->'values') as t(v));
  delete from public.product_options
  where product_id = p_product
    and id not in (select (a.o->>'id')::uuid from jsonb_array_elements(v_opts) as a(o));
end; $$;

revoke all on function public.save_variant_config(uuid, jsonb) from public, anon, service_role;
grant execute on function public.save_variant_config(uuid, jsonb) to authenticated;
