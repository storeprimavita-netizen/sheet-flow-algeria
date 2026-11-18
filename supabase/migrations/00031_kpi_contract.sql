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

-- ---------------------------------------------------------------------------
-- 6) Reroute the money model onto the shared order set and the Algiers day.
--    pnl_lines is 00022 with: range defaults and the fixed-fee delivered share
--    on kpi_order_set / Algiers days (was placed_at::date, UTC).
-- ---------------------------------------------------------------------------
create or replace function public.pnl_lines(
  p_order_ids uuid[],
  p_from      date,
  p_to        date,
  p_product   uuid[],
  p_filtered  boolean
) returns jsonb
language plpgsql stable security invoker set search_path = public as $$
declare
  v_ws uuid := public.current_workspace_id();
  v_from date; v_to date; v_days int;
  v_received int; v_confirmed int; v_delivered int; v_returned int; v_cancelled int;
  v_revenue numeric; v_cogs numeric; v_cash numeric;
  v_return_fee numeric; v_ad_test numeric; v_ad_scaling numeric; v_expenses numeric;
  v_fixed_month numeric; v_ws_delivered int; v_share numeric; v_fixed numeric;
  v_net numeric;
begin
  if not public.is_admin() then return null; end if;

  v_from := coalesce(p_from,
    (select min((placed_at at time zone 'Africa/Algiers')::date) from public.orders where workspace_id = v_ws),
    (now() at time zone 'Africa/Algiers')::date);
  v_to   := coalesce(p_to, (now() at time zone 'Africa/Algiers')::date);
  v_days := greatest(v_to - v_from + 1, 1);

  select count(*),
         count(*) filter (where o.confirmation_status = 'confirmed'),
         count(*) filter (where o.delivery_status = 'delivered'),
         count(*) filter (where o.delivery_status = 'returned'),
         count(*) filter (where o.confirmation_status = 'cancelled' or o.delivery_status = 'cancelled'),
         coalesce(sum(o.sale_price * o.quantity) filter (where o.delivery_status = 'delivered'), 0),
         coalesce(sum(pc.sourcing_cost_dzd * o.quantity) filter (where o.delivery_status = 'delivered'), 0),
         coalesce(sum(o.sale_price * o.quantity) filter (
           where o.delivery_status = 'delivered'
             and not exists (select 1 from public.cash_collections c where c.order_id = o.id)), 0)
    into v_received, v_confirmed, v_delivered, v_returned, v_cancelled, v_revenue, v_cogs, v_cash
    from public.orders o
    left join public.product_costs pc on pc.product_id = o.product_id
   where o.id = any (p_order_ids);

  select coalesce((value->>'amount')::numeric, 150) into v_return_fee
    from public.settings where workspace_id = v_ws and key = 'return_fee';
  v_return_fee := coalesce(v_return_fee, 150);

  select coalesce(sum(a.amount_dzd) filter (where a.kind = 'test'), 0),
         coalesce(sum(a.amount_dzd) filter (where a.kind <> 'test'), 0)
    into v_ad_test, v_ad_scaling
    from public.ad_spend_daily a
   where a.workspace_id = v_ws and a.spent_on between v_from and v_to
     and (p_product is null or a.product_id = any (p_product));

  select coalesce(sum(e.amount_dzd), 0) into v_expenses
    from public.expenses e
   where e.workspace_id = v_ws and e.spent_on between v_from and v_to
     and (p_product is null or e.product_id = any (p_product));

  select coalesce(sum(amount_dzd), 0) into v_fixed_month
    from public.fixed_fees where workspace_id = v_ws and is_active;

  if p_filtered or p_product is not null then
    select count(*) into v_ws_delivered from public.orders o
     where o.id in (select k.id from public.kpi_order_set(v_from, v_to, null) k)
       and o.delivery_status = 'delivered';
    v_share := case when v_ws_delivered = 0 then 0 else v_delivered::numeric / v_ws_delivered end;
  else
    v_share := 1;
  end if;
  v_fixed := round(v_fixed_month * v_days / 30.0 * v_share, 2);

  v_net := v_revenue - v_cogs - v_returned * v_return_fee
           - v_ad_test - v_ad_scaling - v_expenses - v_fixed;

  return jsonb_build_object(
    'period_from', v_from, 'period_to', v_to, 'days', v_days,
    'orders_received', v_received, 'orders_confirmed', v_confirmed,
    'orders_delivered', v_delivered, 'orders_returned', v_returned,
    'orders_cancelled', v_cancelled,
    'revenue', v_revenue,
    'cogs', v_cogs,
    'return_fee_unit', v_return_fee,
    'return_fees', v_returned * v_return_fee,
    'ad_spend_test', v_ad_test,
    'ad_spend_scaling', v_ad_scaling,
    'ad_spend', v_ad_test + v_ad_scaling,
    'expenses', v_expenses,
    'fixed_fees_monthly', v_fixed_month,
    'fixed_share', v_share,
    'fixed_fees', v_fixed,
    'net_profit', v_net,
    'cash_to_collect', v_cash
  );
end; $$;

-- Thin entry point for finance / product pages: period + optional product.
create or replace function public.pnl_summary(
  p_from date default null, p_to date default null, p_product uuid default null
) returns jsonb
language sql stable security invoker set search_path = public as $$
  select public.pnl_lines(
    array(select k.id from public.kpi_order_set(p_from, p_to,
            case when p_product is null then null else array[p_product] end) k),
    p_from, p_to,
    case when p_product is null then null else array[p_product] end,
    false);
$$;

-- dashboard_stats: 00022 with the order set from kpi_order_set, rates / funnel /
-- wilaya delivery rate / stop_shipping_auto from kpi_rates (matured data only),
-- shipped = parcels out of stock (order_stock_target < 0) or returned, daily
-- series on Algiers days. New output key 'kpi' (kpi_lines of the same ids).
create or replace function public.dashboard_stats(
  p_from                date default null,
  p_to                  date default null,
  p_product             uuid[] default null,
  p_wilaya              int[] default null,
  p_source              order_source[] default null,
  p_conf_agent          uuid[] default null,
  p_deliv_agent         uuid[] default null,
  p_confirmation_status confirmation_status[] default null,
  p_delivery_status     delivery_status[] default null,
  p_agent               uuid[] default null
) returns jsonb
language plpgsql stable security invoker set search_path = public as $$
declare
  v_ws    uuid := public.current_workspace_id();
  v_admin boolean := public.is_admin();
  v_order_ids uuid[];
  v_received  int; v_confirmed int; v_shipped int; v_delivered int;
  v_cancelled int; v_returned  int;
  v_kpi jsonb; v_filtered boolean;
  v_category  jsonb; v_wilaya jsonb; v_agent jsonb; v_product jsonb; v_daily jsonb;
  v_conf_breakdown jsonb; v_deliv_breakdown jsonb;
  v_pnl jsonb; v_return_fee numeric; v_fixed_day numeric;
  v_min_orders int; v_min_rate numeric;
  v_series_from date; v_series_to date;
begin
  select array_agg(o.id) into v_order_ids
  from public.orders o
  where o.workspace_id = v_ws
    and o.id in (select k.id from public.kpi_order_set(p_from, p_to, p_product) k)
    and (p_wilaya      is null or o.wilaya_code = any (p_wilaya))
    and (p_source      is null or o.source = any (p_source))
    and (p_conf_agent  is null or o.assigned_confirmation_agent = any (p_conf_agent))
    and (p_deliv_agent is null or o.assigned_delivery_agent = any (p_deliv_agent))
    and (p_confirmation_status is null or o.confirmation_status = any (p_confirmation_status))
    and (p_delivery_status     is null or o.delivery_status = any (p_delivery_status))
    and (p_agent is null or o.assigned_confirmation_agent = any (p_agent)
                         or o.assigned_delivery_agent = any (p_agent));

  v_filtered := p_wilaya is not null or p_source is not null or p_conf_agent is not null
    or p_deliv_agent is not null or p_confirmation_status is not null
    or p_delivery_status is not null or p_agent is not null;

  -- P1-1: every rate and funnel count comes from kpi_lines (the one KPI source)
  v_kpi := public.kpi_lines(coalesce(v_order_ids, '{}'), p_from, p_to, p_product, v_filtered);
  v_received  := (v_kpi->'counts'->>'received')::int;
  v_confirmed := (v_kpi->'counts'->>'confirmed')::int;
  v_delivered := (v_kpi->'counts'->>'delivered')::int;
  v_returned  := (v_kpi->'counts'->>'returned')::int;
  select count(*) filter (where o.confirmation_status = 'cancelled' or o.delivery_status = 'cancelled'),
         count(*) filter (where o.delivery_status = 'returned'
           or public.order_stock_target(o.delivery_status, o.quantity, o.swapped_to_order_id is not null,
                exists (select 1 from public.orders r
                         where r.swapped_to_order_id = o.id and r.workspace_id = o.workspace_id),
                o.confirmation_status) < 0)
    into v_cancelled, v_shipped
    from public.orders o where o.id = any (coalesce(v_order_ids, '{}'));

  select jsonb_agg(jsonb_build_object('status', b.confirmation_status, 'count', b.n))
  into v_conf_breakdown
  from (
    select o.confirmation_status, count(*) as n
    from public.orders o
    where o.id = any (v_order_ids)
    group by o.confirmation_status
  ) b;

  select jsonb_agg(jsonb_build_object('status', b.delivery_status, 'count', b.n))
  into v_deliv_breakdown
  from (
    select o.delivery_status, count(*) as n
    from public.orders o
    where o.id = any (v_order_ids)
    group by o.delivery_status
  ) b;

  if v_admin then
    -- 15b: every money line comes from pnl_lines() — the one P&L formula.
    v_pnl := public.pnl_lines(v_order_ids, p_from, p_to, p_product, v_filtered);
    v_return_fee := (v_pnl->>'return_fee_unit')::numeric;
    v_fixed_day  := (v_pnl->>'fixed_fees_monthly')::numeric / 30 * (v_pnl->>'fixed_share')::numeric;

    select jsonb_agg(jsonb_build_object('category', c.category, 'amount_dzd', c.amount_dzd))
    into v_category
    from (
      select e.category, sum(e.amount_dzd) as amount_dzd
      from public.expenses e
      where e.workspace_id = v_ws
        and (p_from is null or e.spent_on >= p_from)
        and (p_to   is null or e.spent_on <= p_to)
        and (p_product is null or e.product_id = any (p_product))
      group by e.category
    ) c;

    select coalesce((s.value->>'min_orders')::int, 10),
           coalesce((s.value->>'min_delivery_rate')::numeric, 40)
      into v_min_orders, v_min_rate
      from public.settings s
      where s.workspace_id = v_ws and s.key = 'stop_shipping_rule';
    v_min_orders := coalesce(v_min_orders, 10);
    v_min_rate   := coalesce(v_min_rate, 40);

    -- delivery rate and the auto stop-shipping flag come from kpi_rates; the
    -- flag needs matured data (den >= 10, little still in flight) and the rule
    select jsonb_agg(to_jsonb(w) order by w.total_orders desc) into v_wilaya
    from (
      select g.wilaya_code, g.wilaya_name, g.total_orders,
             (k->'counts'->>'confirmed')::int as confirmed_orders,
             (k->'counts'->>'delivered')::int as delivered_orders,
             (k->'counts'->>'returned')::int  as returned_orders,
             round(100 * (k->'delivery'->>'value')::numeric, 1) as delivery_rate,
             coalesce(wf.stop_shipping, false) as stop_shipping_manual,
             coalesce((k->'delivery'->>'matured')::boolean
                      and (k->'delivery'->>'den')::int >= v_min_orders
                      and 100 * (k->'delivery'->>'value')::numeric < v_min_rate, false)
               as stop_shipping_auto
      from (
        select o.wilaya_code, wl.name as wilaya_name, count(*) as total_orders,
               array_agg(o.id) as ids
        from public.orders o
        left join public.wilayas wl on wl.code = o.wilaya_code
        where o.id = any (v_order_ids)
        group by o.wilaya_code, wl.name
      ) g
      cross join lateral public.kpi_rates(g.ids) k
      left join public.wilaya_fees wf
        on wf.workspace_id = v_ws and wf.wilaya_code = g.wilaya_code
    ) w;

    select jsonb_agg(to_jsonb(a)) into v_agent
    from (
      select h.actor as user_id, pr.display_name, h.stage,
             count(distinct h.order_id) as orders_handled,
             count(*) filter (where h.to_status = 'confirmed') as confirmed,
             count(*) filter (where h.to_status = 'delivered') as delivered,
             count(*) filter (where h.to_status in ('cancelled', 'returned')) as lost,
             extract(epoch from avg(h.created_at - o.created_at)
               filter (where h.to_status in ('confirmed', 'cancelled'))) as avg_decision_seconds
      from public.order_status_history h
      join public.orders o on o.id = h.order_id
      left join public.profiles pr on pr.user_id = h.actor
      where o.id = any (v_order_ids) and h.actor is not null
      group by h.actor, pr.display_name, h.stage
    ) a;

    select jsonb_agg(to_jsonb(p)) into v_product
    from (
      select o.product_id, pd.name,
             count(*) as orders_received,
             count(*) filter (where o.confirmation_status = 'confirmed') as orders_confirmed,
             count(*) filter (where o.delivery_status = 'delivered')     as orders_delivered,
             count(*) filter (where o.delivery_status = 'returned')      as orders_returned,
             round(100 * (public.kpi_rates(array_agg(o.id))->'confirmation'->>'value')::numeric, 1)
               as confirmation_rate,
             round(100 * (public.kpi_rates(array_agg(o.id))->'delivery'->>'value')::numeric, 1)
               as delivery_rate,
             coalesce(sum(o.sale_price * o.quantity) filter (where o.delivery_status = 'delivered'), 0)
               as revenue_dzd
      from public.orders o
      join public.products pd on pd.id = o.product_id
      where o.id = any (v_order_ids)
      group by o.product_id, pd.name
    ) p;

    -- Daily series for the KPI sparklines + profit/spend-over-time chart — one
    -- aggregate feeds both instead of forking the query per widget. Falls back
    -- to a trailing-30-day window when no explicit range is set, capped at a
    -- year even for a wide custom range (ponytail: generate_series guard, not
    -- expected in normal use — this app's date filters are always operator-picked).
    v_series_from := coalesce(p_from, (now() at time zone 'Africa/Algiers')::date - 29);
    v_series_to   := least(coalesce(p_to, (now() at time zone 'Africa/Algiers')::date), v_series_from + 365);

    select jsonb_agg(jsonb_build_object(
      'day', d.day,
      'orders_received',  coalesce(od.orders_received, 0),
      'orders_confirmed', coalesce(od.orders_confirmed, 0),
      'orders_delivered', coalesce(od.orders_delivered, 0),
      'revenue_dzd',   coalesce(od.revenue_dzd, 0),
      'invested_dzd',  coalesce(od.sourcing_dzd, 0) + coalesce(od.returned, 0) * v_return_fee
                       + coalesce(se.expenses_dzd, 0) + coalesce(sa.ad_dzd, 0) + v_fixed_day
    ) order by d.day) into v_daily
    from generate_series(v_series_from, v_series_to, interval '1 day') as d(day)
    left join (
      select (o.placed_at at time zone 'Africa/Algiers')::date as day,
             count(*) as orders_received,
             count(*) filter (where o.confirmation_status = 'confirmed') as orders_confirmed,
             count(*) filter (where o.delivery_status = 'delivered') as orders_delivered,
             coalesce(sum(o.sale_price * o.quantity) filter (where o.delivery_status = 'delivered'), 0) as revenue_dzd,
             coalesce(sum(pc.sourcing_cost_dzd * o.quantity) filter (where o.delivery_status = 'delivered'), 0) as sourcing_dzd,
             count(*) filter (where o.delivery_status = 'returned') as returned
      from public.orders o
      left join public.product_costs pc on pc.product_id = o.product_id
      where o.id = any (v_order_ids)
      group by 1
    ) od on od.day = d.day::date
    left join (
      select e.spent_on as day, sum(e.amount_dzd) as expenses_dzd
      from public.expenses e
      where e.workspace_id = v_ws
        and (p_product is null or e.product_id = any (p_product))
        and e.spent_on between v_series_from and v_series_to
      group by 1
    ) se on se.day = d.day::date
    left join (
      select a.spent_on as day, sum(a.amount_dzd) as ad_dzd
      from public.ad_spend_daily a
      where a.workspace_id = v_ws
        and (p_product is null or a.product_id = any (p_product))
        and a.spent_on between v_series_from and v_series_to
      group by 1
    ) sa on sa.day = d.day::date;
  end if;

  return jsonb_build_object(
    'is_admin', v_admin,
    'stage_counts', jsonb_build_object(
      'received', v_received, 'confirmed', v_confirmed, 'shipped', v_shipped,
      'delivered', v_delivered, 'cancelled', v_cancelled, 'returned', v_returned
    ),
    'funnel', jsonb_build_array(
      jsonb_build_object('stage', 'received',  'count', v_received),
      jsonb_build_object('stage', 'confirmed', 'count', v_confirmed),
      jsonb_build_object('stage', 'shipped',   'count', v_shipped),
      jsonb_build_object('stage', 'delivered', 'count', v_delivered)
    ),
    'kpis', jsonb_build_object(
      'revenue_dzd',     (v_pnl->>'revenue')::numeric,
      'invested_dzd',    (v_pnl->>'revenue')::numeric - (v_pnl->>'net_profit')::numeric,
      'net_profit_dzd',  (v_pnl->>'net_profit')::numeric,
      'confirmation_rate', round(100 * (v_kpi->'confirmation'->>'value')::numeric, 1),
      'delivery_rate',     round(100 * (v_kpi->'delivery'->>'value')::numeric, 1)
    ),
    'pnl',               v_pnl,
    'kpi',               v_kpi,
    'category_spending', coalesce(v_category, '[]'::jsonb),
    'per_wilaya',        coalesce(v_wilaya, '[]'::jsonb),
    'per_agent',         coalesce(v_agent, '[]'::jsonb),
    'per_product',       coalesce(v_product, '[]'::jsonb),
    'daily',             coalesce(v_daily, '[]'::jsonb),
    'stop_shipping_min_orders', v_min_orders,
    'confirmation_breakdown', coalesce(v_conf_breakdown, '[]'::jsonb),
    'delivery_breakdown',     coalesce(v_deliv_breakdown, '[]'::jsonb)
  );
end; $$;

-- ---------------------------------------------------------------------------
-- 7) Views on the shared set. Every replaced view keeps security_invoker
--    (create or replace without it would reset reloptions and leak every
--    workspace's cost data to anon), its grants and its output keys.
-- ---------------------------------------------------------------------------
create or replace view public.wilaya_stats
with (security_invoker = true) as
with rule as (
  select w.id as workspace_id,
         coalesce((s.value->>'min_orders')::int, 10)             as min_orders,
         coalesce((s.value->>'min_delivery_rate')::numeric, 40)  as min_rate
  from public.workspaces w
  left join public.settings s
    on s.workspace_id = w.id and s.key = 'stop_shipping_rule'
), g as (
  select o.workspace_id, o.wilaya_code, count(*) as total_orders, array_agg(o.id) as ids
  from public.orders o
  where o.id in (select k.id from public.kpi_order_set(null, null, null) k)
  group by o.workspace_id, o.wilaya_code
)
select g.workspace_id, g.wilaya_code, wl.name as wilaya_name,
       g.total_orders,
       (k.r->'counts'->>'confirmed')::bigint as confirmed_orders,
       (k.r->'counts'->>'delivered')::bigint as delivered_orders,
       (k.r->'counts'->>'returned')::bigint  as returned_orders,
       round(100 * (k.r->'delivery'->>'value')::numeric, 1) as delivery_rate,
       coalesce(wf.stop_shipping, false) as stop_shipping_manual,
       coalesce((k.r->'delivery'->>'matured')::boolean
                and (k.r->'delivery'->>'den')::int >= r.min_orders
                and 100 * (k.r->'delivery'->>'value')::numeric < r.min_rate, false) as stop_shipping_auto
from g
join rule r on r.workspace_id = g.workspace_id
cross join lateral (select public.kpi_rates(g.ids) as r) k
left join public.wilayas wl on wl.code = g.wilaya_code
left join public.wilaya_fees wf
  on wf.workspace_id = g.workspace_id and wf.wilaya_code = g.wilaya_code;

create or replace view public.product_stats
with (security_invoker = true) as
select p.id, p.workspace_id, p.name, p.status, p.stock,
       (k.r->'counts'->>'received')::bigint  as orders_received,
       (k.r->'counts'->>'confirmed')::bigint as orders_confirmed,
       (k.r->'counts'->>'delivered')::bigint as orders_delivered,
       (k.r->'counts'->>'returned')::bigint  as orders_returned,
       round(100 * (k.r->'confirmation'->>'value')::numeric, 1) as confirmation_rate,
       round(100 * (k.r->'delivery'->>'value')::numeric, 1)     as delivery_rate,
       (select sum(o.sale_price * o.quantity) from public.orders o
         where o.id = any (g.ids) and o.delivery_status = 'delivered') as revenue_dzd,
       (select sum(e.amount_dzd) from public.expenses e where e.product_id = p.id)   as expenses_dzd,
       (select sum(a.amount_dzd) from public.ad_spend_daily a where a.product_id = p.id) as ad_spend_dzd,
       (select pc.sourcing_cost_dzd from public.product_costs pc where pc.product_id = p.id) as sourcing_cost_dzd
from public.products p
cross join lateral (
  select coalesce(array_agg(o.id), '{}'::uuid[]) as ids
  from public.orders o
  where o.product_id = p.id
    and o.id in (select s.id from public.kpi_order_set(null, null, null) s)
) g
cross join lateral (select public.kpi_rates(g.ids) as r) k;
