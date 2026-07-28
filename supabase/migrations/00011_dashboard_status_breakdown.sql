-- ============================================================================
-- MNW COD ERP v2 — dashboard_stats: confirmation/delivery status breakdown
-- (Phase 12b §7 — "a part to see different diagrams of confirmation,
-- delivery, different status" beyond the single funnel; adds the raw
-- per-status counts the funnel doesn't carry, same filtered order set.)
-- ============================================================================

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
  v_revenue   numeric; v_expenses numeric; v_ad numeric; v_sourcing numeric;
  v_category  jsonb; v_wilaya jsonb; v_agent jsonb; v_product jsonb; v_daily jsonb;
  v_conf_breakdown jsonb; v_deliv_breakdown jsonb;
  v_min_orders int; v_min_rate numeric;
  v_series_from date; v_series_to date;
begin
  select
    array_agg(o.id),
    count(*),
    count(*) filter (where o.confirmation_status = 'confirmed'),
    count(*) filter (where o.confirmation_status = 'confirmed'
                      and o.delivery_status not in ('wait_for_deposit', 'cancelled')),
    count(*) filter (where o.delivery_status = 'delivered'),
    count(*) filter (where o.confirmation_status = 'cancelled' or o.delivery_status = 'cancelled'),
    count(*) filter (where o.delivery_status = 'returned')
  into v_order_ids, v_received, v_confirmed, v_shipped, v_delivered, v_cancelled, v_returned
  from public.orders o
  where o.workspace_id = v_ws
    and (p_from is null or o.placed_at::date >= p_from)
    and (p_to   is null or o.placed_at::date <= p_to)
    and (p_product     is null or o.product_id = any (p_product))
    and (p_wilaya      is null or o.wilaya_code = any (p_wilaya))
    and (p_source      is null or o.source = any (p_source))
    and (p_conf_agent  is null or o.assigned_confirmation_agent = any (p_conf_agent))
    and (p_deliv_agent is null or o.assigned_delivery_agent = any (p_deliv_agent))
    and (p_confirmation_status is null or o.confirmation_status = any (p_confirmation_status))
    and (p_delivery_status     is null or o.delivery_status = any (p_delivery_status))
    and (p_agent is null or o.assigned_confirmation_agent = any (p_agent)
                         or o.assigned_delivery_agent = any (p_agent));

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
    select coalesce(sum(o.sale_price * o.quantity), 0) into v_revenue
    from public.orders o
    where o.id = any (v_order_ids) and o.delivery_status = 'delivered';

    select coalesce(sum(pc.sourcing_cost_dzd * o.quantity), 0) into v_sourcing
    from public.orders o
    join public.product_costs pc on pc.product_id = o.product_id
    where o.id = any (v_order_ids) and o.delivery_status = 'delivered';

    -- expenses/ad spend have no wilaya/source/agent/status dimension — scope by
    -- product + date range only (not v_order_ids, which is order-level).
    select coalesce(sum(e.amount_dzd), 0) into v_expenses
    from public.expenses e
    where e.workspace_id = v_ws
      and (p_from is null or e.spent_on >= p_from)
      and (p_to   is null or e.spent_on <= p_to)
      and (p_product is null or e.product_id = any (p_product));

    select coalesce(sum(a.amount_dzd), 0) into v_ad
    from public.ad_spend_daily a
    where a.workspace_id = v_ws
      and (p_from is null or a.spent_on >= p_from)
      and (p_to   is null or a.spent_on <= p_to)
      and (p_product is null or a.product_id = any (p_product));

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

    select jsonb_agg(to_jsonb(w)) into v_wilaya
    from (
      select o.wilaya_code, wl.name as wilaya_name,
             count(*) as total_orders,
             count(*) filter (where o.confirmation_status = 'confirmed') as confirmed_orders,
             count(*) filter (where o.delivery_status = 'delivered')     as delivered_orders,
             count(*) filter (where o.delivery_status = 'returned')      as returned_orders,
             case when count(*) filter (where o.confirmation_status = 'confirmed') = 0 then null
                  else round(100.0 * count(*) filter (where o.delivery_status = 'delivered')
                       / count(*) filter (where o.confirmation_status = 'confirmed'), 1)
             end as delivery_rate,
             coalesce(wf.stop_shipping, false) as stop_shipping_manual,
             (count(*) filter (where o.confirmation_status = 'confirmed') >= v_min_orders
              and coalesce(100.0 * count(*) filter (where o.delivery_status = 'delivered')
                  / nullif(count(*) filter (where o.confirmation_status = 'confirmed'), 0), 100)
                  < v_min_rate) as stop_shipping_auto
      from public.orders o
      left join public.wilayas wl on wl.code = o.wilaya_code
      left join public.wilaya_fees wf
        on wf.workspace_id = o.workspace_id and wf.wilaya_code = o.wilaya_code
      where o.id = any (v_order_ids)
      group by o.wilaya_code, wl.name, wf.stop_shipping
      order by total_orders desc
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
             round(100.0 * count(*) filter (where o.confirmation_status = 'confirmed') / count(*), 1)
               as confirmation_rate,
             case when count(*) filter (where o.confirmation_status = 'confirmed') = 0 then null
                  else round(100.0 * count(*) filter (where o.delivery_status = 'delivered')
                       / count(*) filter (where o.confirmation_status = 'confirmed'), 1)
             end as delivery_rate,
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
    v_series_from := coalesce(p_from, current_date - 29);
    v_series_to   := least(coalesce(p_to, current_date), v_series_from + 365);

    select jsonb_agg(jsonb_build_object(
      'day', d.day,
      'orders_received',  coalesce(od.orders_received, 0),
      'orders_confirmed', coalesce(od.orders_confirmed, 0),
      'orders_delivered', coalesce(od.orders_delivered, 0),
      'revenue_dzd',   coalesce(od.revenue_dzd, 0),
      'invested_dzd',  coalesce(od.sourcing_dzd, 0) + coalesce(se.expenses_dzd, 0) + coalesce(sa.ad_dzd, 0)
    ) order by d.day) into v_daily
    from generate_series(v_series_from, v_series_to, interval '1 day') as d(day)
    left join (
      select o.placed_at::date as day,
             count(*) as orders_received,
             count(*) filter (where o.confirmation_status = 'confirmed') as orders_confirmed,
             count(*) filter (where o.delivery_status = 'delivered') as orders_delivered,
             coalesce(sum(o.sale_price * o.quantity) filter (where o.delivery_status = 'delivered'), 0) as revenue_dzd,
             coalesce(sum(pc.sourcing_cost_dzd * o.quantity) filter (where o.delivery_status = 'delivered'), 0) as sourcing_dzd
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
      'revenue_dzd',     case when v_admin then v_revenue else null end,
      'invested_dzd',    case when v_admin then v_expenses + v_ad + v_sourcing else null end,
      'net_profit_dzd',  case when v_admin then v_revenue - (v_expenses + v_ad + v_sourcing) else null end,
      'confirmation_rate', case when v_received = 0 then null else round(100.0 * v_confirmed / v_received, 1) end,
      'delivery_rate',     case when v_confirmed = 0 then null else round(100.0 * v_delivered / v_confirmed, 1) end
    ),
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
