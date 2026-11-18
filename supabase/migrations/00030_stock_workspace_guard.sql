-- P0-8 (D30): stock only moves inside one workspace; review-3 findings 3 and 4.
--   * apply_stock_movement refuses a movement whose workspace is not the product's workspace
--     (covers hand-written movements and the order trigger alike).
--   * order_stock_effects refuses an order carrying a product of another workspace.
--   * reasons: 'order_swapped' for the stock a swap takes back; 'order_stock_sync' whenever the
--     order's held stock was not what its previous row implied (legacy / drifted rows).
--   * swap_order: the whole swap (new order B + original A to 'swap' + link) in one transaction,
--     under the caller's own rights (security invoker), so a failure leaves nothing deducted twice.
alter type public.stock_reason add value if not exists 'order_swapped';

create or replace function public.apply_stock_movement()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.products where id = new.product_id and workspace_id = new.workspace_id) then
    raise exception 'stock movement must target a product of its own workspace';
  end if;
  update public.products set stock = stock + new.delta where id = new.product_id;
  return new;
end; $$;

create or replace function public.order_stock_effects()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_target  integer;
  v_current integer;
  v_old_target integer := 0;
  v_reason  public.stock_reason;
  v_old_product uuid;
  v_old_qty integer;
  c_reasons constant public.stock_reason[] :=
    array['order_confirmed','order_returned','order_reverted','order_stock_sync','order_swapped','delivered','returned']::public.stock_reason[];
begin
  if tg_op = 'UPDATE' then
    if old.confirmation_status is not distinct from new.confirmation_status
       and old.delivery_status is not distinct from new.delivery_status
       and old.quantity is not distinct from new.quantity
       and old.product_id is not distinct from new.product_id then
      return new;
    end if;
    v_old_product := old.product_id;
    v_old_qty := old.quantity;
    if old.product_id is not distinct from new.product_id then
      v_old_target := case when old.confirmation_status = 'confirmed'
                            and old.delivery_status not in ('returned','cancelled','swap')
                           then -old.quantity else 0 end;
    end if;
  end if;

  if new.product_id is not null
     and not exists (select 1 from public.products where id = new.product_id and workspace_id = new.workspace_id) then
    raise exception 'order product must belong to the order''s workspace';
  end if;

  -- product changed while stock was held: give it back on the old product first
  if v_old_product is not null and v_old_product is distinct from new.product_id then
    select coalesce(sum(delta), 0) into v_current from public.stock_movements
      where order_id = new.id and product_id = v_old_product and reason = any(c_reasons);
    if v_current <> 0 then
      insert into public.stock_movements(workspace_id, product_id, delta, reason, order_id, created_by)
      values (new.workspace_id, v_old_product, -v_current, 'order_stock_sync', new.id, auth.uid());
    end if;
  end if;

  if new.product_id is null then return new; end if;

  v_target := case when new.confirmation_status = 'confirmed'
                    and new.delivery_status not in ('returned','cancelled','swap')
                   then -new.quantity else 0 end;
  select coalesce(sum(delta), 0) into v_current from public.stock_movements
    where order_id = new.id and product_id = new.product_id and reason = any(c_reasons);

  if v_target <> v_current then
    v_reason := case
      when tg_op = 'UPDATE' and (v_old_product is distinct from new.product_id or v_old_qty is distinct from new.quantity)
        then 'order_stock_sync'
      when v_current <> v_old_target then 'order_stock_sync'
      when new.delivery_status = 'swap' then 'order_swapped'
      when v_target < v_current then 'order_confirmed'
      when new.delivery_status = 'returned' then 'order_returned'
      else 'order_reverted' end;
    insert into public.stock_movements(workspace_id, product_id, delta, reason, order_id, created_by)
    values (new.workspace_id, new.product_id, v_target - v_current, v_reason, new.id, auth.uid());
  end if;
  return new;
end; $$;

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
language plpgsql security invoker set search_path = public as $$
declare
  a public.orders%rowtype;
  v_b uuid;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  select * into a from public.orders
    where id = p_order_id and workspace_id = public.current_workspace_id() for update;
  if not found then raise exception 'order not found'; end if;

  insert into public.orders(workspace_id, source, product_id, variant, quantity, sale_price, delivery_fee,
      delivery_type, customer_id, customer_name, customer_phone, wilaya_code, commune, address,
      confirmation_status, delivery_status, placed_at)
  values (a.workspace_id, 'manual', a.product_id, a.variant, a.quantity, a.sale_price, a.delivery_fee,
      a.delivery_type, p_customer_id, p_customer_name, p_customer_phone, p_wilaya_code, nullif(p_commune, ''), nullif(p_address, ''),
      'confirmed', 'wait_for_deposit', now())
  returning id into v_b;

  perform public.transition_order_status(p_order_id, null, 'swap');
  update public.orders set swapped_to_order_id = v_b where id = p_order_id;
  return v_b;
end; $$;
revoke all on function public.swap_order(uuid, uuid, text, text, smallint, text, text) from public, anon;
grant execute on function public.swap_order(uuid, uuid, text, text, smallint, text, text) to authenticated;
