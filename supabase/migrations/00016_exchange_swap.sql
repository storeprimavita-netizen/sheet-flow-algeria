-- Phase 14b — Exchange, Swap statuses + swapped_to_order_id + return_fee default 150.

alter type public.delivery_status add value if not exists 'exchange';
alter type public.delivery_status add value if not exists 'swap';

alter table public.orders
  add column if not exists swapped_to_order_id uuid references public.orders(id) on delete set null;
create index if not exists orders_swapped_idx on public.orders (workspace_id, swapped_to_order_id);

-- Locked decision: return_fee default 150 DZD. Bump only untouched workspaces
-- (still at the old 100 default) so a workspace that customized it is preserved.
update public.settings
  set value = '{"amount": 150}'
  where key = 'return_fee' and (value->>'amount')::numeric = 100;
