-- P0-8 (D25): stock held by an order is reconciled to a target after every update.
--   target  = -quantity while confirmed AND delivery not returned/cancelled, else 0
--   current = net of this order's movements for the product (legacy 'delivered'/'returned' rows ignored)
-- One reconciling movement of (target - current) is written when they differ, so repeated
-- or combined status changes can never double-deduct or double-restore.
alter type public.stock_reason add value if not exists 'order_stock_sync';

create index if not exists stock_movements_order_idx on public.stock_movements(order_id, reason);

create or replace function public.order_stock_effects()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_target  integer;
  v_current integer;
  v_reason  public.stock_reason;
  c_reasons constant public.stock_reason[] :=
    array['order_confirmed','order_returned','order_reverted','order_stock_sync']::public.stock_reason[];
begin
  -- product changed while stock was held: give it back on the old product first
  if old.product_id is not null and old.product_id is distinct from new.product_id then
    select coalesce(sum(delta), 0) into v_current from public.stock_movements
      where order_id = new.id and product_id = old.product_id and reason = any(c_reasons);
    if v_current <> 0 then
      insert into public.stock_movements(workspace_id, product_id, delta, reason, order_id, created_by)
      values (new.workspace_id, old.product_id, -v_current, 'order_stock_sync', new.id, auth.uid());
    end if;
  end if;

  if new.product_id is null then return new; end if;

  v_target := case when new.confirmation_status = 'confirmed'
                    and new.delivery_status not in ('returned','cancelled')
                   then -new.quantity else 0 end;
  select coalesce(sum(delta), 0) into v_current from public.stock_movements
    where order_id = new.id and product_id = new.product_id and reason = any(c_reasons);

  if v_target <> v_current then
    v_reason := case
      when old.product_id is distinct from new.product_id or old.quantity is distinct from new.quantity
        then 'order_stock_sync'
      when v_target < v_current then 'order_confirmed'
      when new.delivery_status = 'returned' then 'order_returned'
      else 'order_reverted' end;
    insert into public.stock_movements(workspace_id, product_id, delta, reason, order_id, created_by)
    values (new.workspace_id, new.product_id, v_target - v_current, v_reason, new.id, auth.uid());
  end if;
  return new;
end; $$;
