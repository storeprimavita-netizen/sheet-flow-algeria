-- 14d: move the stock decrement point from delivery_status to confirmation_status.
-- Confirmed ⇒ reserve stock; leave-confirmed (pre-delivery) ⇒ restore; returned ⇒ restore.
alter type public.stock_reason add value if not exists 'order_confirmed';
alter type public.stock_reason add value if not exists 'order_reverted';
alter type public.stock_reason add value if not exists 'order_returned';

create or replace function public.order_stock_effects()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.product_id is null then return new; end if;

  -- (1) order confirmed for shipping ⇒ stock leaves inventory
  if new.confirmation_status = 'confirmed' and old.confirmation_status <> 'confirmed' then
    insert into public.stock_movements(workspace_id, product_id, delta, reason, order_id, created_by)
    values (new.workspace_id, new.product_id, -new.quantity, 'order_confirmed', new.id, auth.uid());

  -- (2) delivered order returned to warehouse ⇒ stock restored
  elsif new.delivery_status = 'returned' and old.delivery_status <> 'returned' then
    insert into public.stock_movements(workspace_id, product_id, delta, reason, order_id, created_by)
    values (new.workspace_id, new.product_id, new.quantity, 'order_returned', new.id, auth.uid());

  -- (3) confirmed order falls back (cancelled/no_answer/reopened) before delivery ⇒ restore.
  --     Guard: only if it never reached a delivered-family state (item not in customer's hands).
  elsif old.confirmation_status = 'confirmed' and new.confirmation_status <> 'confirmed'
        and old.delivery_status not in ('delivered','returned','exchange','swap') then
    insert into public.stock_movements(workspace_id, product_id, delta, reason, order_id, created_by)
    values (new.workspace_id, new.product_id, new.quantity, 'order_reverted', new.id, auth.uid());
  end if;
  return new;
end; $$;
