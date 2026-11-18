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

-- ---------------------------------------------------------------------------
-- 3) Rates. kpi_metric builds one {num, den, value, matured}; value is a
--    fraction 0..1 (the UI formats the percent). matured (relative to now()):
--    den >= 10 AND (still-unresolved orders of the cohort placed in the last
--    7 days) / den <= 20%. Constants live here; see docs/DB.md.
--    Confirmation = confirmed / decided (confirmed, cancelled, no_answer,
--    closed_phone); swap replacements (born confirmed) are not in it.
--    Delivery = delivered / (delivered + returned + cancelled-after-pickup);
--    cancelled-after-pickup = delivery 'cancelled' with a zr_shipments row or a
--    delivery-stage carrier history entry. Return = returned / same denominator.
-- ---------------------------------------------------------------------------
create or replace function public.kpi_metric(p_num int, p_den int, p_young_unresolved int)
returns jsonb
language sql immutable set search_path = public as $$
  select jsonb_build_object(
    'num', p_num, 'den', p_den,
    'value', case when p_den = 0 then null else p_num::numeric / p_den end,
    'matured', p_den >= 10 and p_young_unresolved::numeric / p_den <= 0.2);
$$;

create or replace function public.kpi_rates(p_order_ids uuid[])
returns jsonb
language sql stable security invoker set search_path = public as $$
  with s as (
    select o.confirmation_status, o.delivery_status, o.placed_at,
           exists (select 1 from public.orders r
                    where r.swapped_to_order_id = o.id and r.workspace_id = o.workspace_id) as repl,
           (o.delivery_status = 'cancelled' and (
              exists (select 1 from public.zr_shipments z where z.order_id = o.id)
              or exists (select 1 from public.order_status_history h
                          where h.order_id = o.id and h.stage = 'delivery'
                            and h.to_status in ('bureau_deposited', 'in_transit', 'out_for_delivery',
                                                'stop_desk_waiting', 'delayed', 'returning')))) as after_pickup,
           (public.order_stock_target(o.delivery_status, o.quantity, o.swapped_to_order_id is not null,
              exists (select 1 from public.orders r
                       where r.swapped_to_order_id = o.id and r.workspace_id = o.workspace_id),
              o.confirmation_status) < 0 and o.delivery_status <> 'delivered') as in_flight
      from public.orders o
     where o.id = any (p_order_ids) and o.workspace_id = public.current_workspace_id()
  ), a as (
    select count(*) filter (where not repl)::int as received,
           count(*) filter (where not repl and confirmation_status = 'confirmed')::int as confirmed,
           count(*) filter (where not repl and confirmation_status
                              in ('confirmed', 'cancelled', 'no_answer', 'closed_phone'))::int as decided,
           count(*) filter (where not repl and confirmation_status = 'wait_for_confirmation'
                              and placed_at > now() - interval '7 days')::int as conf_young,
           count(*) filter (where delivery_status = 'delivered')::int as delivered,
           count(*) filter (where delivery_status = 'returned')::int as returned,
           count(*) filter (where after_pickup)::int as after_pickup,
           count(*) filter (where in_flight)::int as in_flight,
           count(*) filter (where in_flight and placed_at > now() - interval '7 days')::int as flight_young
      from s
  )
  select jsonb_build_object(
    'confirmation', public.kpi_metric(confirmed, decided, conf_young)
                    || jsonb_build_object('of_received',
                         case when received = 0 then null else confirmed::numeric / received end),
    'delivery', public.kpi_metric(delivered, delivered + returned + after_pickup, flight_young),
    'return',   public.kpi_metric(returned,  delivered + returned + after_pickup, flight_young),
    'counts', jsonb_build_object(
      'received', received, 'confirmed', confirmed, 'delivered', delivered,
      'returned', returned, 'in_flight', in_flight))
  from a;
$$;

-- ---------------------------------------------------------------------------
-- 4) kpi_lines: rates + on_road + money. order_ids null = select the set from
--    from/to/product. Money (admin only) by D45: latest USD rate (not the
--    per-row fx_rate). Agents get rates, no money keys, usd_rate null.
--    cost_per_delivered = ad spend / delivered; cpa_delivered = (ad spend +
--    expenses) / delivered; both null with no delivered order or a non-product
--    filter (ad spend has no wilaya/agent grain). waterfall is signed and sums
--    exactly to net_profit (delivery fee is pass-through, no part).
-- ---------------------------------------------------------------------------
create or replace function public.kpi_lines(
  p_order_ids uuid[], p_from date, p_to date, p_product uuid[], p_filtered boolean
) returns jsonb
language plpgsql stable security invoker set search_path = public as $$
declare
  v_ws uuid := public.current_workspace_id();
  v_ids uuid[];
  v_out jsonb;
  v_road_orders int; v_road_units int;
  v_pnl jsonb; v_rate numeric; v_rate_date date;
  v_delivered int; v_ad numeric; v_acq numeric;
  v_cpd numeric; v_cpa numeric;
begin
  v_ids := coalesce(p_order_ids,
    array(select k.id from public.kpi_order_set(p_from, p_to, p_product) k));
  v_out := public.kpi_rates(v_ids);

  -- on_road ignores eligibility and dates: same rule as product_stock_stages
  select count(*)::int, coalesce(sum(o.quantity), 0)::int into v_road_orders, v_road_units
    from public.orders o
   where o.workspace_id = v_ws and o.product_id is not null
     and (p_product is null or o.product_id = any (p_product))
     and o.delivery_status <> 'delivered'
     and public.order_stock_target(o.delivery_status, o.quantity, o.swapped_to_order_id is not null,
           exists (select 1 from public.orders r
                    where r.swapped_to_order_id = o.id and r.workspace_id = o.workspace_id),
           o.confirmation_status) < 0;
  v_out := jsonb_set(v_out, '{counts}', (v_out->'counts')
    || jsonb_build_object('on_road_orders', v_road_orders, 'on_road_units', v_road_units));

  if not public.is_admin() then
    return v_out || jsonb_build_object('usd_rate', null);
  end if;

  v_pnl := public.pnl_lines(v_ids, p_from, p_to, p_product, p_filtered);
  select e.rate_dzd, e.valid_from into v_rate, v_rate_date
    from public.exchange_rates e
   where e.workspace_id = v_ws and e.currency = 'USD'
     and e.valid_from <= least(coalesce(p_to, (now() at time zone 'Africa/Algiers')::date),
                               (now() at time zone 'Africa/Algiers')::date)
   order by e.valid_from desc, e.created_at desc limit 1;

  v_delivered := (v_out->'counts'->>'delivered')::int;
  v_ad  := (v_pnl->>'ad_spend')::numeric;
  v_acq := v_ad + (v_pnl->>'expenses')::numeric;
  if v_delivered > 0 and not coalesce(p_filtered, false) then
    v_cpd := v_ad / v_delivered;
    v_cpa := v_acq / v_delivered;
  end if;

  return v_out || jsonb_build_object(
    'ad_spend_dzd', v_ad,
    'usd_rate', v_rate,
    'usd_rate_date', v_rate_date,
    'ad_spend_usd', v_ad / v_rate,
    'cost_per_delivered_dzd', v_cpd,
    'cost_per_delivered_usd', v_cpd / v_rate,
    'cpa_delivered_dzd', v_cpa,
    'cpa_delivered_usd', v_cpa / v_rate,
    'roas', case when v_ad = 0 then null else (v_pnl->>'revenue')::numeric / v_ad end,
    'net_profit', (v_pnl->>'net_profit')::numeric,
    'waterfall', jsonb_build_object(
      'revenue', (v_pnl->>'revenue')::numeric,
      'cogs', -(v_pnl->>'cogs')::numeric,
      'returns', -(v_pnl->>'return_fees')::numeric,
      'ads', -v_ad,
      'expenses_fixed', -((v_pnl->>'expenses')::numeric + (v_pnl->>'fixed_fees')::numeric)));
end; $$;

-- Entry point for finance / product pages: selects its own orders.
create or replace function public.kpi_summary(
  p_from date default null, p_to date default null, p_product uuid default null
) returns jsonb
language sql stable security invoker set search_path = public as $$
  select public.kpi_lines(null, p_from, p_to,
    case when p_product is null then null else array[p_product] end, false);
$$;

revoke execute on function public.kpi_metric(int, int, int) from public, anon;
revoke execute on function public.kpi_rates(uuid[]) from public, anon;
revoke execute on function public.kpi_lines(uuid[], date, date, uuid[], boolean) from public, anon;
revoke execute on function public.kpi_summary(date, date, uuid) from public, anon;
grant execute on function public.kpi_metric(int, int, int) to authenticated;
grant execute on function public.kpi_rates(uuid[]) to authenticated;
grant execute on function public.kpi_lines(uuid[], date, date, uuid[], boolean) to authenticated;
grant execute on function public.kpi_summary(date, date, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) product_stock_v: the stock numbers the UI shows (admin-only like
--    product_stock_stages, which it reads)
-- ---------------------------------------------------------------------------
create or replace view public.product_stock_v with (security_invoker = true) as
select s.product_id, s.workspace_id, s.in_stock, s.reserved, s.on_road, s.delivered,
       greatest(s.in_stock - s.reserved, 0) as sellable,
       greatest(s.in_stock - s.reserved, 0) <= p.low_stock_threshold as low
  from public.product_stock_stages s
  join public.products p on p.id = s.product_id;
revoke all on public.product_stock_v from anon, public;
grant select on public.product_stock_v to authenticated;
