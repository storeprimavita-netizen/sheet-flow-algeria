-- ============================================================================
-- MNW COD ERP v2 — dashboard BI aggregate RPC (SPEC §7)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- dashboard_stats — one jsonb blob for the whole filtered dashboard.
--
-- security invoker: `orders` row visibility (and therefore stage_counts /
-- funnel / rates) already narrows to an agent's queue via RLS (o_sel in
-- 00004_orders.sql). Money (kpis.revenue_dzd/invested_dzd/net_profit_dzd) and
-- the per_wilaya/per_agent/per_product breakdowns are additionally gated by
-- an explicit is_admin() check here — orders.sale_price itself is NOT
-- RLS-hidden from agents (they read it in their own queue rows), so relying
-- on table-level RLS alone would leak revenue to a delivery agent who can
-- see every confirmed order. expenses/ad_spend_daily/product_costs ARE
-- admin-only tables (RLS), so those sub-selects are belt-and-braces null for
-- agents even without the explicit check.
--
-- The five order/product/wilaya/date/source/agent filter args are evaluated
-- once into v_order_ids; every downstream aggregate joins against that id
-- array instead of repeating the six-clause predicate.
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_stats(
  p_from        date default null,
  p_to          date default null,
  p_product     uuid[] default null,
  p_wilaya      int[] default null,
  p_source      order_source[] default null,
  p_conf_agent  uuid[] default null,
  p_deliv_agent uuid[] default null
) returns jsonb
language plpgsql stable security invoker set search_path = public as $$
declare
  v_ws    uuid := public.current_workspace_id();
  v_admin boolean := public.is_admin();
  v_order_ids uuid[];
  v_received  int; v_confirmed int; v_shipped int; v_delivered int;
  v_cancelled int; v_returned  int;
  v_revenue   numeric; v_expenses numeric; v_ad numeric; v_sourcing numeric;
  v_category  jsonb; v_wilaya jsonb; v_agent jsonb; v_product jsonb;
  v_min_orders int; v_min_rate numeric;
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
    and (p_deliv_agent is null or o.assigned_delivery_agent = any (p_deliv_agent));

  if v_admin then
    select coalesce(sum(o.sale_price * o.quantity), 0) into v_revenue
    from public.orders o
    where o.id = any (v_order_ids) and o.delivery_status = 'delivered';

    select coalesce(sum(pc.sourcing_cost_dzd * o.quantity), 0) into v_sourcing
    from public.orders o
    join public.product_costs pc on pc.product_id = o.product_id
    where o.id = any (v_order_ids) and o.delivery_status = 'delivered';

    -- expenses/ad spend have no wilaya/source/agent dimension — scope by
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
    'per_product',       coalesce(v_product, '[]'::jsonb)
  );
end; $$;
