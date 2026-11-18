-- P0-8 (D34, D35, D30, D31): stock in three stages, add-only log, workspace guard, swap link.
--   products.stock = pieces in the warehouse. A piece leaves the warehouse when the parcel goes to the carrier
--   (bureau_deposited and later), comes back on returned, and an order holds nothing once it is linked to its
--   replacement (D31). order_stock_target() is the ONLY place that rule lives; the trigger and the view call it.
alter type public.stock_reason add value if not exists 'order_stock_sync';
alter type public.stock_reason add value if not exists 'order_swapped';
alter type public.stock_reason add value if not exists 'order_shipped';

create index if not exists stock_movements_order_idx on public.stock_movements (order_id, reason);
create index if not exists orders_swapped_to_idx on public.orders (swapped_to_order_id);

-- ---------------------------------------------------------------------------
-- 1) the rule
-- ---------------------------------------------------------------------------
create or replace function public.order_stock_target(
  p_status public.delivery_status, p_qty integer, p_linked_original boolean, p_replacement boolean)
returns integer
language sql immutable set search_path = public, pg_temp as $$
  select case
    when p_linked_original then 0
    when p_status in ('bureau_deposited','in_transit','out_for_delivery','stop_desk_waiting','delayed',
                      'returning','exchange','delivered') then -p_qty
    when p_status = 'wait_for_deposit' and p_replacement then -p_qty
    else 0
  end
$$;

-- ---------------------------------------------------------------------------
-- 2) workspace guard on every movement (D30)
-- ---------------------------------------------------------------------------
create or replace function public.apply_stock_movement()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.products where id = new.product_id and workspace_id = new.workspace_id) then
    raise exception 'stock movement must target a product of its own workspace';
  end if;
  update public.products set stock = stock + new.delta where id = new.product_id;
  return new;
end; $$;

-- reasons that count as "stock held by an order" (legacy delivered/returned/order_reverted included)
create or replace function public.stock_order_reasons()
returns public.stock_reason[]
language plpgsql immutable set search_path = public, pg_temp as $$   -- plpgsql: new enum values are not checked at create time
begin
  return array['order_confirmed','order_reverted','order_returned','order_stock_sync','order_swapped',
               'order_shipped','delivered','returned']::public.stock_reason[];
end; $$;

-- ---------------------------------------------------------------------------
-- 3) reconcile one order against one product (internal; not callable by API roles)
--    p_product null = the order's current product. Other product = release it (target 0).
--    p_reason null = pick: status-only change on a consistent order -> shipped / returned, else order_stock_sync.
-- ---------------------------------------------------------------------------
create or replace function public.stock_reconcile_order(
  p_order_id uuid, p_product uuid, p_reason public.stock_reason, p_old_status public.delivery_status)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  o public.orders%rowtype;
  v_product uuid;
  v_linked boolean;
  v_repl boolean;
  v_target integer;
  v_old_target integer;
  v_current integer;
  v_reason public.stock_reason;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then return; end if;
  v_product := coalesce(p_product, o.product_id);
  if v_product is null then return; end if;

  v_linked := o.swapped_to_order_id is not null;
  v_repl := exists (select 1 from public.orders r where r.swapped_to_order_id = o.id and r.workspace_id = o.workspace_id);
  v_target := case when v_product = o.product_id
                   then public.order_stock_target(o.delivery_status, o.quantity, v_linked, v_repl) else 0 end;
  select coalesce(sum(delta), 0) into v_current from public.stock_movements
    where order_id = o.id and product_id = v_product and reason = any(public.stock_order_reasons());
  if v_target = v_current then return; end if;

  v_reason := p_reason;
  if v_reason is null then
    v_old_target := case when p_old_status is null then null
                         else public.order_stock_target(p_old_status, o.quantity, v_linked, v_repl) end;
    v_reason := case
      when v_old_target is not distinct from v_current and v_target < v_current then 'order_shipped'
      when v_old_target is not distinct from v_current and v_target > v_current then 'order_returned'
      else 'order_stock_sync' end;
  end if;
  insert into public.stock_movements(workspace_id, product_id, delta, reason, order_id, created_by)
  values (o.workspace_id, v_product, v_target - v_current, v_reason, o.id, auth.uid());
end; $$;
revoke all on function public.stock_reconcile_order(uuid, uuid, public.stock_reason, public.delivery_status)
  from public, anon, authenticated, service_role;

create or replace function public.order_stock_effects()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_reason public.stock_reason;
  v_old_status public.delivery_status;
  v_other uuid;
begin
  if tg_op = 'UPDATE' then
    if old.delivery_status is not distinct from new.delivery_status
       and old.quantity is not distinct from new.quantity
       and old.product_id is not distinct from new.product_id
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
    -- product changed: release the old product first
    if old.product_id is not null and old.product_id is distinct from new.product_id then
      perform public.stock_reconcile_order(new.id, old.product_id, 'order_stock_sync', null);
    end if;
    if old.product_id is distinct from new.product_id or old.quantity is distinct from new.quantity then
      v_reason := 'order_stock_sync';
    elsif old.swapped_to_order_id is distinct from new.swapped_to_order_id then
      v_reason := case when new.swapped_to_order_id is not null then 'order_swapped' else 'order_stock_sync' end;
    else
      v_old_status := old.delivery_status;
    end if;
  else
    v_reason := 'order_shipped';
  end if;

  perform public.stock_reconcile_order(new.id, null, v_reason, v_old_status);

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

-- D42: only swap_order writes a swap link: from empty, never re-pointed, never on insert, by anyone.
-- The one other change is the FK clearing it when the replacement is deleted.
create or replace function public.orders_swap_link_guard()
returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    if new.swapped_to_order_id is not null then
      raise exception 'swap link is written only by swap_order';
    end if;
    return new;
  end if;
  if new.swapped_to_order_id is not distinct from old.swapped_to_order_id then return new; end if;
  if old.swapped_to_order_id is null and new.swapped_to_order_id is not null
     and coalesce(current_setting('mnw.swap_link', true), '') = '1' then
    return new;
  end if;
  if old.swapped_to_order_id is not null and new.swapped_to_order_id is null
     and not exists (select 1 from public.orders where id = old.swapped_to_order_id) then
    return new;   -- replacement deleted (FK set null)
  end if;
  raise exception 'swap link is written only by swap_order';
end; $$;

drop trigger if exists orders_swap_link_guard on public.orders;
create trigger orders_swap_link_guard
  before insert or update of swapped_to_order_id on public.orders
  for each row execute function public.orders_swap_link_guard();

drop trigger if exists orders_stock_effects on public.orders;
create trigger orders_stock_effects
  after insert or update of delivery_status, quantity, product_id, swapped_to_order_id on public.orders
  for each row execute function public.order_stock_effects();

-- D41: deleting an order gives back only pieces that never left the warehouse: stage before pickup,
-- cancelled or returned (this also clears an old-rule reservation). A swap replacement follows the same rule
-- (D42). On road or delivered keeps its pieces out (D34); the admin adds a correction line in the log (D35). Skipped when the product or workspace goes away (cascade).
create or replace function public.order_stock_release()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r record;
begin
  if public.order_stock_target(old.delivery_status, old.quantity, false, false) >= 0 then
    for r in select product_id, sum(delta)::integer as held from public.stock_movements
             where order_id = old.id and reason = any(public.stock_order_reasons())
             group by product_id having sum(delta) <> 0 loop
      if exists (select 1 from public.products where id = r.product_id)
         and exists (select 1 from public.workspaces where id = old.workspace_id) then
        insert into public.stock_movements(workspace_id, product_id, delta, reason, order_id, created_by)
        values (old.workspace_id, r.product_id, -r.held, 'order_stock_sync', old.id, auth.uid());
      end if;
    end loop;
  end if;
  return old;
end; $$;

drop trigger if exists orders_stock_release on public.orders;
create trigger orders_stock_release
  before delete on public.orders
  for each row execute function public.order_stock_release();

-- deleting a swap original: its replacement stops being one, so reconcile it
create or replace function public.order_stock_after_delete()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.swapped_to_order_id is not null
     and exists (select 1 from public.workspaces where id = old.workspace_id) then
    perform public.stock_reconcile_order(old.swapped_to_order_id, null, 'order_stock_sync', null);
  end if;
  return old;
end; $$;

drop trigger if exists orders_stock_after_delete on public.orders;
create trigger orders_stock_after_delete
  after delete on public.orders
  for each row execute function public.order_stock_after_delete();

-- D35 in spirit: products.stock changes only through a stock movement (apply_stock_movement runs one trigger level deeper)
create or replace function public.products_stock_guard()
returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if new.stock is distinct from old.stock and pg_trigger_depth() < 2 then
    raise exception 'products.stock changes only through a stock movement';
  end if;
  return new;
end; $$;

drop trigger if exists products_stock_guard on public.products;
create trigger products_stock_guard
  before update of stock on public.products
  for each row execute function public.products_stock_guard();

-- ---------------------------------------------------------------------------
-- 4) add-only log (D35)
-- ---------------------------------------------------------------------------
drop policy if exists stock_movements_adm on public.stock_movements;
create policy stock_movements_sel on public.stock_movements for select to authenticated
  using (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()));
create policy stock_movements_ins on public.stock_movements for insert to authenticated
  with check (workspace_id = (select public.current_workspace_id()) and (select public.is_admin())
              and reason in ('purchase', 'correction') and order_id is null);
revoke update, delete, truncate on public.stock_movements from anon, authenticated, service_role;

create or replace function public.stock_log_add_only()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' then
    -- cascade from a deleted product or workspace only
    if not exists (select 1 from public.products where id = old.product_id)
       or not exists (select 1 from public.workspaces where id = old.workspace_id) then
      return old;
    end if;
  else
    -- FK set null after the order is gone: the only change allowed
    if old.order_id is not null and new.order_id is null
       and (to_jsonb(new) - 'order_id') = (to_jsonb(old) - 'order_id')
       and not exists (select 1 from public.orders where id = old.order_id) then
      return new;
    end if;
  end if;
  raise exception 'stock log is add-only';
end; $$;

drop trigger if exists stock_movements_add_only on public.stock_movements;
create trigger stock_movements_add_only
  before update or delete on public.stock_movements
  for each row execute function public.stock_log_add_only();

-- ---------------------------------------------------------------------------
-- 5) swap_order: new order B + original A -> swap + link, one transaction, caller's rights (D31)
-- ---------------------------------------------------------------------------
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
  if a.delivery_status not in ('returning', 'returned', 'exchange', 'delivered') then
    raise exception 'swap not allowed from status %', a.delivery_status;
  end if;
  if p_customer_id is not null
     and not exists (select 1 from public.customers where id = p_customer_id and workspace_id = a.workspace_id) then
    raise exception 'customer must belong to the order''s workspace';
  end if;

  insert into public.orders(workspace_id, source, product_id, variant, quantity, sale_price, delivery_fee,
      delivery_type, customer_id, customer_name, customer_phone, wilaya_code, commune, address,
      confirmation_status, delivery_status, placed_at)
  values (a.workspace_id, 'manual', a.product_id, a.variant, a.quantity, a.sale_price, a.delivery_fee,
      a.delivery_type, p_customer_id, p_customer_name, p_customer_phone, p_wilaya_code, nullif(p_commune, ''), nullif(p_address, ''),
      'confirmed', 'wait_for_deposit', now())
  returning id into v_b;

  -- link first (reconciles A -> 0 and B as a replacement on road), then A goes to 'swap' (D42)
  perform set_config('mnw.swap_link', '1', true);
  update public.orders set swapped_to_order_id = v_b where id = p_order_id;
  perform set_config('mnw.swap_link', '', true);
  perform public.transition_order_status(p_order_id, null, 'swap');
  return v_b;
end; $$;
revoke all on function public.swap_order(uuid, uuid, text, text, smallint, text, text) from public, anon;
grant execute on function public.swap_order(uuid, uuid, text, text, smallint, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6) the four numbers per product (admin only)
-- ---------------------------------------------------------------------------
create or replace view public.product_stock_stages with (security_invoker = true) as
select p.id as product_id,
       p.workspace_id,
       p.stock as in_stock,
       coalesce(sum(f.quantity) filter (where f.confirmation_status = 'confirmed' and f.delivery_status = 'wait_for_deposit'
                                          and not f.is_replacement and not f.is_linked), 0)::integer as reserved,
       coalesce(sum(f.quantity) filter (where f.target < 0 and f.delivery_status <> 'delivered'), 0)::integer as on_road,
       coalesce(sum(f.quantity) filter (where f.target < 0 and f.delivery_status = 'delivered'), 0)::integer as delivered
from public.products p
left join (
  select s.*, public.order_stock_target(s.delivery_status, s.quantity, s.is_linked, s.is_replacement) as target
  from (
    select o.product_id, o.quantity, o.delivery_status, o.confirmation_status,
           o.swapped_to_order_id is not null as is_linked,
           exists (select 1 from public.orders r where r.swapped_to_order_id = o.id and r.workspace_id = o.workspace_id) as is_replacement
    from public.orders o
  ) s
) f on f.product_id = p.id
where public.is_admin()
group by p.id, p.workspace_id, p.stock;
revoke all on public.product_stock_stages from anon;
grant select on public.product_stock_stages to authenticated;
