-- STORE-1 review 2: lock order, label freshness, duplicate-set race. Replaces keep the grants of 00046.

-- #7: products first, then the variant (same order as stock_count_variants), so a count and a carrier sync cannot deadlock.
create or replace function public.apply_stock_movement()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.products set stock = stock + new.delta
    where id = new.product_id and workspace_id = new.workspace_id;
  if not found then
    raise exception 'stock movement must target a product of its own workspace';
  end if;
  if new.variant_id is not null then
    update public.product_variants set stock = stock + new.delta
      where id = new.variant_id and product_id = new.product_id and workspace_id = new.workspace_id;
    if not found then raise exception 'stock movement variant must belong to its product and workspace'; end if;
  end if;
  return new;
end; $$;

-- #9: the label snapshot follows the variant on every write of variant_id or variant.
create or replace function public.orders_variant_label()
returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare
  v_active boolean;
  v_label text;
  v_changed boolean := tg_op = 'INSERT' or old.variant_id is distinct from new.variant_id;
begin
  if new.variant_id is null then return new; end if;
  if v_changed then
    select is_active into v_active from public.product_variants where id = new.variant_id;
    if v_active is not true and coalesce(current_setting('mnw.swap_variant', true), '') <> '1' then
      raise exception 'this variant is inactive';
    end if;
  end if;
  v_label := public.variant_label(new.variant_id);
  if v_label is not null then new.variant := v_label; end if;
  return new;
end; $$;
drop trigger if exists orders_variant_label on public.orders;
create trigger orders_variant_label
  before insert or update of variant_id, variant on public.orders
  for each row execute function public.orders_variant_label();

-- #11: serialise the duplicate-set check per product.
create or replace function public.product_variant_values_unique_set()
returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare
  v uuid := coalesce(new.variant_id, old.variant_id);
  v_product uuid;
  v_sig uuid[];
begin
  select product_id into v_product from public.product_variants where id = v;
  if v_product is null then return null; end if;
  perform pg_advisory_xact_lock(hashtext(v_product::text));
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
