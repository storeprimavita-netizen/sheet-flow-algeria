-- CHART-1 (D77): admin-only chart series, computed in SQL.
-- All four RPCs are security invoker, stable, and return NOTHING unless public.is_admin() (D64):
-- agents see only part of the orders (o_sel), so even their counts would be wrong.
-- Rates are never re-derived: every group calls kpi_rates over the shared order set (D4).
-- Days, weekdays and hours are Africa/Algiers (the session time zone is UTC).
-- Also drops the unused `daily` key from dashboard_stats: one daily money formula (kpi_daily).

-- ---------------------------------------------------------------------------
-- 1) kpi_daily: one row per Algiers day. rates = kpi_rates of that day's orders
--    (counts and rates; days are never averaged). money = null when a non-product
--    filter is set (ads/expenses have no wilaya/source/agent grain). Money sums to
--    pnl_lines exactly: revenue/cogs/returns by order day, ads/expenses by spent_on,
--    fixed = pnl_lines fixed_fees spread round(total/days,2) with the remainder on
--    the last day. Bounds are pnl_lines' period_from/to, clamped to 366 days.
--    immature = the last 7 days: orders there are not delivered yet, so the right
--    edge of the money line dips.
-- ---------------------------------------------------------------------------
create or replace function public.kpi_daily(
  p_from date default null, p_to date default null, p_product uuid[] default null,
  p_filters jsonb default null
) returns table (day date, rates jsonb, money jsonb, immature boolean)
language plpgsql stable security invoker set search_path = public as $$
#variable_conflict use_column
declare
  v_today date := (now() at time zone 'Africa/Algiers')::date;
  v_has_filters boolean := p_filters is not null and p_filters <> '{}'::jsonb;
  v_ids uuid[]; v_pnl jsonb; v_from date; v_to date; v_days int;
  v_fixed numeric; v_fixed_day numeric; v_fee numeric;
begin
  if not public.is_admin() then return; end if;
  if p_from is not null and p_to is not null and p_from > p_to then
    raise exception 'kpi_daily: p_from is after p_to' using errcode = '22023';
  end if;
  v_ids := array(select k.id from public.kpi_order_set(p_from, p_to, p_product, p_filters) k);
  v_pnl := public.pnl_lines(v_ids, p_from, p_to, p_product, v_has_filters);
  v_from := (v_pnl->>'period_from')::date;
  v_to := (v_pnl->>'period_to')::date;
  v_days := (v_pnl->>'days')::int;
  v_fixed := (v_pnl->>'fixed_fees')::numeric;
  v_fee := (v_pnl->>'return_fee_unit')::numeric;
  v_fixed_day := round(v_fixed / greatest(v_days, 1), 2);
  v_from := greatest(v_from, v_to - 365);

  return query
  with od as (
    select (coalesce(o.placed_at, o.created_at) at time zone 'Africa/Algiers')::date as day,
           array_agg(o.id) as ids,
           coalesce(sum(o.sale_price * o.quantity) filter (where o.delivery_status = 'delivered' and o.swapped_to_order_id is null), 0) as revenue,
           coalesce(sum(pc.sourcing_cost_dzd * o.quantity) filter (where o.delivery_status = 'delivered' and o.swapped_to_order_id is null), 0) as cogs,
           count(*) filter (where o.delivery_status = 'returned' and o.swapped_to_order_id is null) as returned
      from public.orders o
      left join public.product_costs pc on pc.product_id = o.product_id
     where o.id = any (v_ids)
     group by 1
  ), ad as (
    select a.spent_on as day, sum(a.amount_dzd) as amt
      from public.ad_spend_daily a
     where a.workspace_id = public.current_workspace_id() and a.spent_on between v_from and v_to
       and (p_product is null or a.product_id = any (p_product))
     group by 1
  ), ex as (
    select e.spent_on as day, sum(e.amount_dzd) as amt
      from public.expenses e
     where e.workspace_id = public.current_workspace_id() and e.spent_on between v_from and v_to
       and (p_product is null or e.product_id = any (p_product))
     group by 1
  ), m as (
    select g.day,
           coalesce(od.ids, '{}'::uuid[]) as ids,
           coalesce(od.revenue, 0) as revenue,
           coalesce(od.cogs, 0) as cogs,
           coalesce(od.returned, 0) * v_fee as return_fees,
           coalesce(ad.amt, 0) as ads,
           coalesce(ex.amt, 0) as expenses,
           case when g.day = v_to then v_fixed - v_fixed_day * (v_days - 1) else v_fixed_day end as fixed
      from (select x::date as day from generate_series(v_from, v_to, interval '1 day') x) g
      left join od on od.day = g.day
      left join ad on ad.day = g.day
      left join ex on ex.day = g.day
  )
  select m.day,
         public.kpi_rates(m.ids),
         case when v_has_filters then null else jsonb_build_object(
           'revenue', m.revenue, 'cogs', m.cogs, 'return_fees', m.return_fees,
           'ad_spend', m.ads, 'expenses', m.expenses, 'fixed', m.fixed,
           'costs', m.cogs + m.return_fees + m.ads + m.expenses + m.fixed,
           'net_profit', m.revenue - (m.cogs + m.return_fees + m.ads + m.expenses + m.fixed)) end,
         m.day > v_today - 7
    from m
   order by m.day;
end; $$;

-- ---------------------------------------------------------------------------
-- 2) Weekday (ISO 1 = Monday .. 7 = Sunday) and hour (0-23) of the order, Algiers time.
-- ---------------------------------------------------------------------------
create or replace function public.kpi_by_weekday_hour(
  p_from date default null, p_to date default null, p_product uuid[] default null,
  p_filters jsonb default null
) returns table (kind text, bucket int, rates jsonb)
language sql stable security invoker set search_path = public as $$
  with s as (
    select o.id, (coalesce(o.placed_at, o.created_at) at time zone 'Africa/Algiers') as ts
      from public.orders o
     where public.is_admin()
       and o.id in (select k.id from public.kpi_order_set(p_from, p_to, p_product, p_filters) k)
  ), g as (
    select 'weekday'::text as kind, extract(isodow from ts)::int as bucket, array_agg(id) as ids from s group by 2
    union all
    select 'hour'::text, extract(hour from ts)::int, array_agg(id) from s group by 2
  )
  select g.kind, g.bucket, public.kpi_rates(g.ids) from g;
$$;

-- ---------------------------------------------------------------------------
-- 3) Per product: kpi_by_wilaya's pattern (honours period, product and filters).
-- ---------------------------------------------------------------------------
create or replace function public.kpi_by_product(
  p_from date default null, p_to date default null, p_product uuid[] default null,
  p_filters jsonb default null
) returns table (product_id uuid, product_name text, rates jsonb)
language sql stable security invoker set search_path = public as $$
  with g as (
    select o.product_id, array_agg(o.id) as ids
      from public.orders o
     where public.is_admin()
       and o.id in (select k.id from public.kpi_order_set(p_from, p_to, p_product, p_filters) k)
     group by o.product_id
  )
  select g.product_id, p.name, public.kpi_rates(g.ids)
    from g
    left join public.products p on p.id = g.product_id;
$$;

-- ---------------------------------------------------------------------------
-- 4) Outcome split: at most 5 exclusive categories that add up to kpi_rates counts.received
--    (replacement orders are not "received", D48). A swapped original counts as returned (D47).
--    delivered | returned | cancelled | unconfirmed (waiting or no answer) | in_progress.
-- ---------------------------------------------------------------------------
create or replace function public.kpi_outcomes(
  p_from date default null, p_to date default null, p_product uuid[] default null,
  p_filters jsonb default null
) returns table (outcome text, n int)
language sql stable security invoker set search_path = public as $$
  select case
           when o.swapped_to_order_id is not null then 'returned'
           when o.delivery_status = 'delivered' then 'delivered'
           when o.delivery_status = 'returned' then 'returned'
           when o.confirmation_status in ('cancelled', 'closed_phone') or o.delivery_status = 'cancelled' then 'cancelled'
           when o.confirmation_status in ('wait_for_confirmation', 'no_answer') then 'unconfirmed'
           else 'in_progress'
         end as outcome,
         count(*)::int
    from public.orders o
   where public.is_admin()
     and o.id in (select k.id from public.kpi_order_set(p_from, p_to, p_product, p_filters) k)
     and not exists (select 1 from public.orders r
                      where r.swapped_to_order_id = o.id and r.workspace_id = o.workspace_id)
   group by 1;
$$;

do $g$
declare f text;
begin
  foreach f in array array[
    'kpi_daily(date, date, uuid[], jsonb)',
    'kpi_by_weekday_hour(date, date, uuid[], jsonb)',
    'kpi_by_product(date, date, uuid[], jsonb)',
    'kpi_outcomes(date, date, uuid[], jsonb)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $g$;

-- ---------------------------------------------------------------------------
-- 5) dashboard_stats without `daily` (nothing read it; kpi_daily is the one daily formula).
--    Body is 00031's, minus the daily series.
-- ---------------------------------------------------------------------------
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
  v_category  jsonb; v_wilaya jsonb; v_agent jsonb; v_product jsonb;
  v_conf_breakdown jsonb; v_deliv_breakdown jsonb;
  v_pnl jsonb;
  v_min_orders int; v_min_rate numeric;
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
    v_pnl := v_kpi->'pnl';

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
      cross join lateral public.kpi_rates(g.ids, p_from, p_to) k
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
             count(*) filter (where o.delivery_status = 'delivered' and o.swapped_to_order_id is null)     as orders_delivered,
             count(*) filter (where o.delivery_status = 'returned' and o.swapped_to_order_id is null)      as orders_returned,
             round(100 * (public.kpi_rates(array_agg(o.id), p_from, p_to)->'confirmation'->>'value')::numeric, 1)
               as confirmation_rate,
             round(100 * (public.kpi_rates(array_agg(o.id), p_from, p_to)->'delivery'->>'value')::numeric, 1)
               as delivery_rate,
             coalesce(sum(o.sale_price * o.quantity) filter (where o.delivery_status = 'delivered' and o.swapped_to_order_id is null), 0)
               as revenue_dzd
      from public.orders o
      join public.products pd on pd.id = o.product_id
      where o.id = any (v_order_ids)
      group by o.product_id, pd.name
    ) p;

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
    'stop_shipping_min_orders', v_min_orders,
    'confirmation_breakdown', coalesce(v_conf_breakdown, '[]'::jsonb),
    'delivery_breakdown',     coalesce(v_deliv_breakdown, '[]'::jsonb)
  );
end; $$;
