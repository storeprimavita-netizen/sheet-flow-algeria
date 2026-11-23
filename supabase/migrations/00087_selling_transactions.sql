-- STORE-3-F: atomically save each Selling section under the variant-config product lock.
create function public.save_product_pricing(
  p_product uuid,
  p_mode text,
  p_deltas jsonb,
  p_overrides jsonb,
  p_compare_at numeric default null
)
returns void
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := public.current_workspace_id();
begin
  if v_workspace is null or not coalesce(public.is_admin(), false) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if p_product is null or p_mode is null or p_mode not in ('uniform', 'per_value', 'per_variant')
     or (p_compare_at is not null and (p_compare_at not between 0 and 10000000 or p_compare_at <> trunc(p_compare_at)))
     or jsonb_typeof(p_deltas) is distinct from 'array'
     or jsonb_typeof(p_overrides) is distinct from 'array' then
    raise exception 'invalid pricing' using errcode = '22023';
  end if;
  if jsonb_array_length(p_deltas) > 200 or jsonb_array_length(p_overrides) > 200
     or exists (
       select 1 from jsonb_array_elements(p_deltas) as delta(value)
       where jsonb_typeof(value->'valueId') is distinct from 'string'
          or jsonb_typeof(value->'delta') is distinct from 'number'
     ) or exists (
       select 1 from jsonb_array_elements(p_overrides) as override(value)
       where jsonb_typeof(value->'variantId') is distinct from 'string'
          or coalesce(jsonb_typeof(value->'price'), '') not in ('number', 'null')
          or coalesce(jsonb_typeof(value->'compareAt'), '') not in ('number', 'null')
     ) then
    raise exception 'invalid pricing rows' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_product::text));
  perform 1 from public.products where id = p_product and workspace_id = v_workspace for update;
  if not found then
    raise exception 'product not found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_deltas) as d("valueId" uuid, delta numeric)
    left join public.product_option_values ov
      on ov.id = d."valueId" and ov.product_id = p_product and ov.workspace_id = v_workspace
    where ov.id is null or abs(d.delta) > 10000000 or d.delta <> trunc(d.delta)
  ) or exists (
    select 1 from jsonb_to_recordset(p_deltas) as d("valueId" uuid)
    group by d."valueId" having count(*) > 1
  ) or exists (
    select 1
    from jsonb_to_recordset(p_overrides) as o("variantId" uuid, price numeric, "compareAt" numeric)
    left join public.product_variants v
      on v.id = o."variantId" and v.product_id = p_product and v.workspace_id = v_workspace
    where v.id is null
       or o.price not between 0 and 10000000 or o.price <> trunc(o.price)
       or o."compareAt" not between 0 and 10000000 or o."compareAt" <> trunc(o."compareAt")
  ) or exists (
    select 1 from jsonb_to_recordset(p_overrides) as o("variantId" uuid)
    group by o."variantId" having count(*) > 1
  ) then
    raise exception 'invalid or stale pricing rows' using errcode = '22023';
  end if;

  if p_mode = 'per_value' then
    update public.product_option_values ov
    set price_delta = d.delta::integer
    from jsonb_to_recordset(p_deltas) as d("valueId" uuid, delta numeric)
    where ov.workspace_id = v_workspace and ov.product_id = p_product and ov.id = d."valueId"
      and ov.price_delta is distinct from d.delta;
  else
    update public.product_option_values set price_delta = 0
    where workspace_id = v_workspace and product_id = p_product and price_delta <> 0;
  end if;

  if p_mode = 'per_variant' then
    update public.product_variants v
    set price_override = o.price::integer, compare_at_override = o."compareAt"::integer
    from jsonb_to_recordset(p_overrides) as o("variantId" uuid, price numeric, "compareAt" numeric)
    where v.workspace_id = v_workspace and v.product_id = p_product and v.id = o."variantId"
      and (v.price_override, v.compare_at_override) is distinct from (o.price, o."compareAt");
  else
    update public.product_variants set price_override = null, compare_at_override = null
    where workspace_id = v_workspace and product_id = p_product
      and (price_override is not null or compare_at_override is not null);
  end if;

  update public.products set pricing_mode = p_mode, compare_at_price = p_compare_at
  where id = p_product and workspace_id = v_workspace
    and (pricing_mode, compare_at_price) is distinct from (p_mode, p_compare_at);
end;
$$;

create function public.save_product_offers(p_product uuid, p_offers jsonb, p_bump jsonb)
returns uuid[]
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
  v_workspace uuid := public.current_workspace_id();
  v_offer record;
  v_bump record;
  v_id uuid;
  v_ids uuid[] := '{}';
  v_position integer := 0;
begin
  if v_workspace is null or not coalesce(public.is_admin(), false) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if p_product is null or jsonb_typeof(p_offers) is distinct from 'array' then
    raise exception 'invalid offers' using errcode = '22023';
  end if;
  if jsonb_array_length(p_offers) > 6 or exists (
    select 1 from jsonb_array_elements(p_offers) as offer(value)
    where coalesce(jsonb_typeof(value->'id'), '') not in ('string', 'null')
       or jsonb_typeof(value->'label') is distinct from 'string'
       or jsonb_typeof(value->'qty') is distinct from 'number'
       or jsonb_typeof(value->'total') is distinct from 'number'
       or jsonb_typeof(value->'isDefault') is distinct from 'boolean'
       or jsonb_typeof(value->'isActive') is distinct from 'boolean'
       or coalesce(jsonb_typeof(value->'activeFrom'), '') not in ('string', 'null')
       or coalesce(jsonb_typeof(value->'activeTo'), '') not in ('string', 'null')
  ) then
    raise exception 'invalid quantity offers' using errcode = '22023';
  end if;

  if p_bump is not null and p_bump <> 'null'::jsonb then
    if jsonb_typeof(p_bump->'productId') is distinct from 'string'
       or jsonb_typeof(p_bump->'price') is distinct from 'number'
       or jsonb_typeof(p_bump->'label') is distinct from 'string'
       or jsonb_typeof(p_bump->'isActive') is distinct from 'boolean' then
      raise exception 'invalid bump inputs' using errcode = '22023';
    end if;
    select * into v_bump
    from jsonb_to_record(p_bump) as b("productId" uuid, price numeric, label text, "isActive" boolean);
    if v_bump.price not between 1 and 10000000 or v_bump.price <> trunc(v_bump.price)
       or char_length(btrim(v_bump.label)) not between 1 and 60 or v_bump.label ~ '[<>]' then
      raise exception 'invalid bump inputs' using errcode = '22023';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_product::text));
  perform 1 from public.products where id = p_product and workspace_id = v_workspace for update;
  if not found then
    raise exception 'product not found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_offers) as o(id uuid, label text, qty numeric, total numeric, "activeFrom" timestamptz, "activeTo" timestamptz)
    left join public.product_offers kept
      on kept.id = o.id and kept.product_id = p_product and kept.workspace_id = v_workspace and kept.kind = 'quantity'
    where (o.id is not null and kept.id is null)
       or o.qty not between 2 and 50 or o.qty <> trunc(o.qty)
       or o.total not between 1 and 10000000 or o.total <> trunc(o.total)
       or char_length(btrim(o.label)) not between 1 and 60 or o.label ~ '[<>]'
       or (o."activeFrom" is not null and not isfinite(o."activeFrom"))
       or (o."activeTo" is not null and not isfinite(o."activeTo"))
       or o."activeFrom" >= o."activeTo"
  ) or exists (
    select 1 from jsonb_to_recordset(p_offers) as o(id uuid)
    where o.id is not null group by o.id having count(*) > 1
  ) or (
    select count(*) from jsonb_to_recordset(p_offers) as o("isDefault" boolean)
    where o."isDefault"
  ) > 1 then
    raise exception 'invalid or stale quantity offers' using errcode = '22023';
  end if;

  delete from public.product_offers saved
  where saved.workspace_id = v_workspace and saved.product_id = p_product and saved.kind = 'quantity'
    and not exists (select 1 from jsonb_to_recordset(p_offers) as o(id uuid) where o.id = saved.id);

  update public.product_offers saved set is_default = false
  where saved.workspace_id = v_workspace and saved.product_id = p_product and saved.kind = 'quantity' and saved.is_default
    and not exists (select 1 from jsonb_to_recordset(p_offers) as o(id uuid, "isDefault" boolean)
                    where o.id = saved.id and o."isDefault");

  for v_offer in
    select o.* from jsonb_array_elements(p_offers) with ordinality as entry(value, position)
    cross join lateral jsonb_to_record(entry.value) as o(
      id uuid, label text, qty numeric, total numeric, "isDefault" boolean, "isActive" boolean,
      "activeFrom" timestamptz, "activeTo" timestamptz
    )
    order by entry.position
  loop
    if v_offer.id is null then
      insert into public.product_offers (workspace_id, product_id, kind, label, qty, total_price, is_default, is_active, active_from, active_to, position)
      values (v_workspace, p_product, 'quantity', btrim(v_offer.label), v_offer.qty, v_offer.total, v_offer."isDefault",
              v_offer."isActive", v_offer."activeFrom", v_offer."activeTo", v_position)
      returning id into v_id;
    else
      v_id := v_offer.id;
      update public.product_offers
      set label = btrim(v_offer.label), qty = v_offer.qty, total_price = v_offer.total,
          is_default = v_offer."isDefault", is_active = v_offer."isActive",
          active_from = v_offer."activeFrom", active_to = v_offer."activeTo", position = v_position
      where id = v_id and workspace_id = v_workspace and product_id = p_product and kind = 'quantity';
      if not found then
        raise exception 'stale quantity offer' using errcode = '22023';
      end if;
    end if;
    v_ids := array_append(v_ids, v_id);
    v_position := v_position + 1;
  end loop;

  if p_bump is null or p_bump = 'null'::jsonb then
    delete from public.product_offers
    where workspace_id = v_workspace and product_id = p_product and kind = 'bump';
  else
    insert into public.product_offers (workspace_id, product_id, kind, label, bump_product_id, bump_price, is_active)
    values (v_workspace, p_product, 'bump', btrim(v_bump.label), v_bump."productId", v_bump.price, v_bump."isActive")
    on conflict (product_id) where kind = 'bump' do update
    set label = excluded.label, bump_product_id = excluded.bump_product_id,
        bump_price = excluded.bump_price, is_active = excluded.is_active;
  end if;

  return v_ids;
end;
$$;

revoke all on function public.save_product_pricing(uuid, text, jsonb, jsonb, numeric) from public, anon, authenticated, service_role;
revoke all on function public.save_product_offers(uuid, jsonb, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.save_product_pricing(uuid, text, jsonb, jsonb, numeric) to authenticated;
grant execute on function public.save_product_offers(uuid, jsonb, jsonb) to authenticated;
