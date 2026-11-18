-- P0-8 (D29): extends the D25 reconcile of 00028.
--   * 'swap' holds nothing (the item moves to the new order); 'exchange' keeps its stock.
--   * reconcile also runs AFTER INSERT, so an order created already confirmed holds stock at once.
--   * an UPDATE that changes none of confirmation_status / delivery_status / quantity / product_id
--     moves no stock (a note edit never writes a movement).
--   * legacy 'delivered'/'returned' movements count as already applied (no recount of old orders).
create or replace function public.order_stock_effects()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_target  integer;
  v_current integer;
  v_reason  public.stock_reason;
  v_old_product uuid;
  v_old_qty integer;
  c_reasons constant public.stock_reason[] :=
    array['order_confirmed','order_returned','order_reverted','order_stock_sync','delivered','returned']::public.stock_reason[];
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
      when v_target < v_current then 'order_confirmed'
      when new.delivery_status = 'returned' then 'order_returned'
      else 'order_reverted' end;
    insert into public.stock_movements(workspace_id, product_id, delta, reason, order_id, created_by)
    values (new.workspace_id, new.product_id, v_target - v_current, v_reason, new.id, auth.uid());
  end if;
  return new;
end; $$;

drop trigger if exists orders_stock_effects on public.orders;
create trigger orders_stock_effects
  after insert or update on public.orders
  for each row execute function public.order_stock_effects();
