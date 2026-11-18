-- P1-1 (D4, D34, D45, D46): one SQL source for every rate and money line.
-- Order set -> kpi_order_set(); rates -> kpi_rates(); rates + money -> kpi_lines();
-- finance/product pages -> kpi_summary(). Pages only format. Admin-only money.
-- No new table: RLS is inherited from orders (security invoker everywhere).

-- ---------------------------------------------------------------------------
-- 1) orders.excluded_reason: admin-set, null = eligible (default-deny guard 00025
--    already keeps agents from writing new order columns)
-- ---------------------------------------------------------------------------
alter table public.orders
  add column excluded_reason text
    check (excluded_reason in ('duplicate', 'test', 'fake', 'other'));
create index orders_kpi_idx on public.orders (workspace_id, placed_at)
  where excluded_reason is null;

-- ---------------------------------------------------------------------------
-- 2) kpi_order_set(from, to, product): THE order set. One range predicate
--    (Africa/Algiers calendar day). Out: excluded_reason, an unconfirmed
--    duplicate suspect, a swap original (swapped_to_order_id, never by status).
-- ---------------------------------------------------------------------------
create or replace function public.kpi_order_set(
  p_from date default null, p_to date default null, p_product uuid[] default null
) returns table (id uuid)
language sql stable security invoker set search_path = public as $$
  select o.id
    from public.orders o
   where o.workspace_id = public.current_workspace_id()
     and (p_from is null or (o.placed_at at time zone 'Africa/Algiers')::date >= p_from)
     and (p_to   is null or (o.placed_at at time zone 'Africa/Algiers')::date <= p_to)
     and (p_product is null or o.product_id = any (p_product))
     and o.excluded_reason is null
     and o.swapped_to_order_id is null
     and not (o.is_duplicate_suspect and o.confirmation_status <> 'confirmed');
$$;
revoke execute on function public.kpi_order_set(date, date, uuid[]) from public, anon;
grant execute on function public.kpi_order_set(date, date, uuid[]) to authenticated;
