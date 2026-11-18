-- ============================================================================
-- STORE-1 (D54): orders and stock movements carry a variant. Order stock follows
-- the variant (a variant change moves the hold, D54.6). The label on the order is a
-- snapshot written by a trigger, so every write path stays right.
-- Also: swap_order copies variant_id. products.stock stays the total.
-- ============================================================================

-- 1) columns -----------------------------------------------------------------
alter table public.orders add column variant_id uuid;
alter table public.orders add constraint orders_variant_fk
  foreign key (variant_id, product_id) references public.product_variants (id, product_id);
alter table public.orders add constraint orders_variant_needs_product check (variant_id is null or product_id is not null);
create index orders_variant_idx on public.orders (variant_id) where variant_id is not null;

alter table public.stock_movements add column variant_id uuid;
alter table public.stock_movements add column count_id uuid;   -- links the two lines of one count by size (D54.2)
alter table public.stock_movements add constraint stock_movements_variant_fk
  foreign key (variant_id, product_id) references public.product_variants (id, product_id);
alter table public.stock_movements add constraint stock_movements_variant_needs_product check (variant_id is null or product_id is not null);
create index stock_movements_variant_idx on public.stock_movements (variant_id) where variant_id is not null;
create index stock_movements_count_idx on public.stock_movements (count_id) where count_id is not null;

-- 2) label snapshot + inactive refusal ----------------------------------------
create or replace function public.variant_label(p_variant uuid)
returns text
language sql stable set search_path = public, pg_temp as $$
  select string_agg(ov.label, ' / ' order by po.position, po.id)
  from public.product_variant_values vv
  join public.product_option_values ov on ov.id = vv.value_id
  join public.product_options po on po.id = vv.option_id
  where vv.variant_id = p_variant
$$;

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
    -- swap_order copies the variant even if it was deactivated since (it sets this flag locally)
    if v_active is not true and coalesce(current_setting('mnw.swap_variant', true), '') <> '1' then
      raise exception 'this variant is inactive';
    end if;
  end if;
  if v_changed then
    v_label := public.variant_label(new.variant_id);
    if v_label is not null then new.variant := v_label; end if;
  end if;
  return new;
end; $$;
drop trigger if exists orders_variant_label on public.orders;
create trigger orders_variant_label
  before insert or update of variant_id on public.orders
  for each row execute function public.orders_variant_label();

-- 3) a movement moves the product total and, when it names one, the variant -----
create or replace function public.apply_stock_movement()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.products where id = new.product_id and workspace_id = new.workspace_id) then
    raise exception 'stock movement must target a product of its own workspace';
  end if;
  if new.variant_id is not null then
    update public.product_variants set stock = stock + new.delta
      where id = new.variant_id and product_id = new.product_id and workspace_id = new.workspace_id;
    if not found then raise exception 'stock movement variant must belong to its product and workspace'; end if;
  end if;
  update public.products set stock = stock + new.delta where id = new.product_id;
  return new;
end; $$;

-- 4) reconcile one order against every (product, variant) pair it touches ----------
--    current pair -> target, every other pair in the log -> 0.
--    p_product: null = all pairs; a product id = only that product's pairs.
--    p_reason null = pick: status-only change on a consistent order -> shipped / returned, else order_stock_sync.
create or replace function public.stock_reconcile_order(
  p_order_id uuid, p_product uuid, p_reason public.stock_reason, p_old_status public.delivery_status,
  p_old_confirmation public.confirmation_status default null)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  o public.orders%rowtype;
  g record;
  v_linked boolean;
  v_repl boolean;
  v_target integer;
  v_old_target integer;
  v_current integer;
  v_reason public.stock_reason;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then return; end if;

  v_linked := o.swapped_to_order_id is not null;
  v_repl := exists (select 1 from public.orders r where r.swapped_to_order_id = o.id and r.workspace_id = o.workspace_id);

  for g in
    select x.product_id, x.variant_id from (
      select m.product_id, m.variant_id from public.stock_movements m
        where m.order_id = o.id and m.reason = any(public.stock_order_reasons())
      union
      select o.product_id, o.variant_id where o.product_id is not null
    ) x
    where p_product is null or x.product_id = p_product
  loop
    v_target := case when g.product_id = o.product_id and g.variant_id is not distinct from o.variant_id
                     then public.order_stock_target(o.delivery_status, o.quantity, v_linked, v_repl, o.confirmation_status)
                     else 0 end;
    select coalesce(sum(delta), 0) into v_current from public.stock_movements
      where order_id = o.id and product_id = g.product_id and variant_id is not distinct from g.variant_id
        and reason = any(public.stock_order_reasons());
    continue when v_target = v_current;

    v_reason := p_reason;
    if v_reason is null then
      v_old_target := case when p_old_status is null then null
                           else public.order_stock_target(p_old_status, o.quantity, v_linked, v_repl, coalesce(p_old_confirmation, o.confirmation_status)) end;
      v_reason := case
        when v_old_target is not distinct from v_current and v_target < v_current then 'order_shipped'
        when v_old_target is not distinct from v_current and v_target > v_current then 'order_returned'
        else 'order_stock_sync' end;
    end if;
    insert into public.stock_movements(workspace_id, product_id, variant_id, delta, reason, order_id, created_by)
    values (o.workspace_id, g.product_id, g.variant_id, v_target - v_current, v_reason, o.id, auth.uid());
  end loop;
end; $$;
revoke all on function public.stock_reconcile_order(uuid, uuid, public.stock_reason, public.delivery_status, public.confirmation_status)
  from public, anon, authenticated, service_role;

-- 5) effects trigger: variant_id is a stock column; a variant-only change logs order_stock_sync.
--    The old "release the old product first" step is gone: reconcile releases every other pair.
create or replace function public.order_stock_effects()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_reason public.stock_reason;
  v_old_status public.delivery_status;
  v_old_conf public.confirmation_status;
  v_other uuid;
begin
  if tg_op = 'UPDATE' then
    if old.delivery_status is not distinct from new.delivery_status
       and old.confirmation_status is not distinct from new.confirmation_status
       and old.quantity is not distinct from new.quantity
       and old.product_id is not distinct from new.product_id
       and old.variant_id is not distinct from new.variant_id
       and old.swapped_to_order_id is not distinct from new.swapped_to_order_id then
      return new;
    end if;
  end if;

  if new.product_id is not null
     and not exists (select 1 from public.products where id = new.product_id and workspace_id = new.workspace_id) then
    raise exception 'order product must belong to the order''s workspace';
  end if;

  -- D30: a swap link must stay inside the workspace
  if new.swapped_to_order_id is not null
     and exists (select 1 from public.orders x where x.id = new.swapped_to_order_id and x.workspace_id <> new.workspace_id) then
    raise exception 'swap link must point to an order of the same workspace';
  end if;

  if tg_op = 'UPDATE' then
    if old.product_id is distinct from new.product_id or old.quantity is distinct from new.quantity
       or old.variant_id is distinct from new.variant_id then
      v_reason := 'order_stock_sync';
    elsif old.swapped_to_order_id is distinct from new.swapped_to_order_id then
      v_reason := case when new.swapped_to_order_id is not null then 'order_swapped' else 'order_stock_sync' end;
    else
      v_old_status := old.delivery_status;
      v_old_conf := old.confirmation_status;
    end if;
  else
    v_reason := 'order_shipped';
  end if;

  perform public.stock_reconcile_order(new.id, null, v_reason, v_old_status, v_old_conf);

  -- the replacement gains or loses "replacement" status when the link moves: reconcile it too
  if tg_op = 'UPDATE' and old.swapped_to_order_id is distinct from new.swapped_to_order_id then
    foreach v_other in array array[old.swapped_to_order_id, new.swapped_to_order_id] loop
      if v_other is not null then
        perform public.stock_reconcile_order(v_other, null,
          case when v_other = new.swapped_to_order_id then 'order_swapped' else 'order_stock_sync' end::public.stock_reason, null);
      end if;
    end loop;
  end if;
  return new;
end; $$;

drop trigger if exists orders_stock_effects on public.orders;
create trigger orders_stock_effects
  after insert or update of delivery_status, confirmation_status, quantity, product_id, variant_id, swapped_to_order_id on public.orders
  for each row execute function public.order_stock_effects();

-- 6) order delete releases per (product, variant) --------------------------------
create or replace function public.order_stock_release()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r record;
begin
  if public.order_stock_target(old.delivery_status, old.quantity, false, false, old.confirmation_status) >= 0 then
    for r in select product_id, variant_id, sum(delta)::integer as held from public.stock_movements
             where order_id = old.id and reason = any(public.stock_order_reasons())
             group by product_id, variant_id having sum(delta) <> 0 loop
      if exists (select 1 from public.products where id = r.product_id)
         and exists (select 1 from public.workspaces where id = old.workspace_id) then
        insert into public.stock_movements(workspace_id, product_id, variant_id, delta, reason, order_id, created_by)
        values (old.workspace_id, r.product_id, r.variant_id, -r.held, 'order_stock_sync', old.id, auth.uid());
      end if;
    end loop;
  end if;
  return old;
end; $$;

-- 7) swap_order (00032 body) copies variant_id; a variant deactivated since is kept, not refused
create or replace function public.swap_order(
  p_order_id uuid,
  p_customer_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_wilaya_code smallint,
  p_commune text,
  p_address text
)
returns uuid
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  a public.orders%rowtype;
  v_b uuid;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  select * into a from public.orders
    where id = p_order_id and workspace_id = public.current_workspace_id() for update;
  if not found then raise exception 'order not found'; end if;
  if a.swapped_to_order_id is not null then return a.swapped_to_order_id; end if;  -- double submit
  if a.product_id is null then raise exception 'order has no product'; end if;
  if a.delivery_status not in ('returning', 'returned') then
    raise exception 'swap not allowed from status %', a.delivery_status;
  end if;
  if p_customer_id is not null
     and not exists (select 1 from public.customers where id = p_customer_id and workspace_id = a.workspace_id) then
    raise exception 'customer must belong to the order''s workspace';
  end if;

  perform set_config('mnw.swap_variant', '1', true);
  insert into public.orders(workspace_id, source, product_id, variant_id, variant, quantity, sale_price, delivery_fee,
      delivery_type, customer_id, customer_name, customer_phone, wilaya_code, commune, address,
      confirmation_status, delivery_status, placed_at)
  values (a.workspace_id, 'manual', a.product_id, a.variant_id, a.variant, a.quantity, a.sale_price, a.delivery_fee,
      a.delivery_type, p_customer_id, p_customer_name, p_customer_phone, p_wilaya_code, nullif(p_commune, ''), nullif(p_address, ''),
      'confirmed', 'wait_for_deposit', now())
  returning id into v_b;
  perform set_config('mnw.swap_variant', '', true);

  -- link first (reconciles A -> 0 and B as a replacement on road), then A goes to 'swap' (D42)
  perform set_config('mnw.swap_link', '1', true);
  update public.orders set swapped_to_order_id = v_b where id = p_order_id;
  perform set_config('mnw.swap_link', '', true);
  perform set_config('mnw.swap_status', '1', true);
  perform public.transition_order_status(p_order_id, null, 'swap');
  perform set_config('mnw.swap_status', '', true);
  return v_b;
end; $$;
revoke all on function public.swap_order(uuid, uuid, text, text, smallint, text, text) from public, anon;
grant execute on function public.swap_order(uuid, uuid, text, text, smallint, text, text) to authenticated;
