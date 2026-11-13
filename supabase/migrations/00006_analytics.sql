-- ============================================================================
-- MNW COD ERP v2 — analytic views (all security_invoker ⇒ caller's RLS applies;
-- financial joins return nulls for agents because the money tables are
-- admin-only). Dashboard RPCs are added in their own phase migration.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) customer_stats — counts + transparent, tunable risk score.
--
-- RISK FORMULA (documented here + docs/DB.md; weights in settings key
-- 'risk_weights', defaults returned=2, cancelled=1, no_answer=0.5):
--
--   points     = w_returned·returned + w_cancelled·cancelled + w_no_answer·no_answer
--   risk_score = least(100, round(100 · points / (w_returned · total_orders)))
--
-- i.e. a customer whose every order came back returned scores 100.
-- ---------------------------------------------------------------------------
create view public.customer_stats
with (security_invoker = true) as
with weights as (
  select w.id as workspace_id,
         coalesce((s.value->>'returned')::numeric,  2)   as w_ret,
         coalesce((s.value->>'cancelled')::numeric, 1)   as w_can,
         coalesce((s.value->>'no_answer')::numeric, 0.5) as w_na
  from public.workspaces w
  left join public.settings s
    on s.workspace_id = w.id and s.key = 'risk_weights'
)
select c.id, c.workspace_id, c.name, c.phone, c.wilaya_code, c.commune,
       count(o.id)                                                          as total_orders,
       count(*) filter (where o.confirmation_status = 'confirmed')          as confirmed_orders,
       count(*) filter (where o.delivery_status     = 'delivered')          as delivered_orders,
       count(*) filter (where o.delivery_status     = 'returned')           as returned_orders,
       count(*) filter (where o.confirmation_status in ('cancelled'))       as cancelled_orders,
       count(*) filter (where o.confirmation_status in ('no_answer','closed_phone')) as no_answer_orders,
       case when count(o.id) = 0 then 0 else least(100, round(
         100 * ( wt.w_ret * count(*) filter (where o.delivery_status = 'returned')
               + wt.w_can * count(*) filter (where o.confirmation_status = 'cancelled')
               + wt.w_na  * count(*) filter (where o.confirmation_status in ('no_answer','closed_phone')))
         / (wt.w_ret * count(o.id)) )) end                                  as risk_score
from public.customers c
join weights wt on wt.workspace_id = c.workspace_id
left join public.orders o on o.customer_id = c.id
group by c.id, wt.w_ret, wt.w_can, wt.w_na;

-- ---------------------------------------------------------------------------
-- 2) wilaya_stats — order counts + delivery rate per wilaya, with the
-- auto stop-shipping breach flag (settings key 'stop_shipping_rule').
-- ---------------------------------------------------------------------------
create view public.wilaya_stats
with (security_invoker = true) as
with rule as (
  select w.id as workspace_id,
         coalesce((s.value->>'min_orders')::int, 10)             as min_orders,
         coalesce((s.value->>'min_delivery_rate')::numeric, 40)  as min_rate
  from public.workspaces w
  left join public.settings s
    on s.workspace_id = w.id and s.key = 'stop_shipping_rule'
)
select o.workspace_id, o.wilaya_code, wl.name as wilaya_name,
       count(*)                                                   as total_orders,
       count(*) filter (where o.confirmation_status = 'confirmed') as confirmed_orders,
       count(*) filter (where o.delivery_status = 'delivered')     as delivered_orders,
       count(*) filter (where o.delivery_status = 'returned')      as returned_orders,
       case when count(*) filter (where o.confirmation_status = 'confirmed') = 0 then null
            else round(100.0 * count(*) filter (where o.delivery_status = 'delivered')
                 / count(*) filter (where o.confirmation_status = 'confirmed'), 1)
       end                                                         as delivery_rate,
       coalesce(wf.stop_shipping, false)                           as stop_shipping_manual,
       (count(*) filter (where o.confirmation_status = 'confirmed') >= r.min_orders
        and coalesce(100.0 * count(*) filter (where o.delivery_status = 'delivered')
            / nullif(count(*) filter (where o.confirmation_status = 'confirmed'), 0), 100)
            < r.min_rate)                                          as stop_shipping_auto
from public.orders o
join rule r on r.workspace_id = o.workspace_id
left join public.wilayas wl on wl.code = o.wilaya_code
left join public.wilaya_fees wf
  on wf.workspace_id = o.workspace_id and wf.wilaya_code = o.wilaya_code
group by o.workspace_id, o.wilaya_code, wl.name, wf.stop_shipping,
         r.min_orders, r.min_rate;

-- ---------------------------------------------------------------------------
-- 3) agent_performance — from status-transition timestamps.
--    confirmation: decisions made, confirm rate, avg time order-created →
--    first decision. delivery: delivered rate on handled orders.
-- ---------------------------------------------------------------------------
create view public.agent_performance
with (security_invoker = true) as
select o.workspace_id, h.actor as user_id, h.stage,
       count(distinct h.order_id)                                    as orders_handled,
       count(*) filter (where h.to_status = 'confirmed')             as confirmed,
       count(*) filter (where h.to_status = 'delivered')             as delivered,
       count(*) filter (where h.to_status in ('cancelled','returned')) as lost,
       avg(h.created_at - o.created_at)
         filter (where h.to_status in ('confirmed','cancelled'))     as avg_decision_time
from public.order_status_history h
join public.orders o on o.id = h.order_id
where h.actor is not null
group by o.workspace_id, h.actor, h.stage;

-- ---------------------------------------------------------------------------
-- 4) product_stats — actuals per product (feeds the read-only "Real" pricing
--    scenario + the Statistics tab). Money columns come from admin-only
--    tables ⇒ null for agents; the app only surfaces this to admins anyway.
-- ---------------------------------------------------------------------------
create view public.product_stats
with (security_invoker = true) as
select p.id, p.workspace_id, p.name, p.status, p.stock,
       count(o.id)                                                    as orders_received,
       count(*) filter (where o.confirmation_status = 'confirmed')    as orders_confirmed,
       count(*) filter (where o.delivery_status = 'delivered')        as orders_delivered,
       count(*) filter (where o.delivery_status = 'returned')         as orders_returned,
       case when count(o.id) = 0 then null
            else round(100.0 * count(*) filter (where o.confirmation_status = 'confirmed') / count(o.id), 1)
       end                                                            as confirmation_rate,
       case when count(*) filter (where o.confirmation_status = 'confirmed') = 0 then null
            else round(100.0 * count(*) filter (where o.delivery_status = 'delivered')
                 / count(*) filter (where o.confirmation_status = 'confirmed'), 1)
       end                                                            as delivery_rate,
       sum(o.sale_price * o.quantity) filter (where o.delivery_status = 'delivered') as revenue_dzd,
       (select sum(e.amount_dzd) from public.expenses e where e.product_id = p.id)   as expenses_dzd,
       (select sum(a.amount_dzd) from public.ad_spend_daily a where a.product_id = p.id) as ad_spend_dzd,
       (select pc.sourcing_cost_dzd from public.product_costs pc where pc.product_id = p.id) as sourcing_cost_dzd
from public.products p
left join public.orders o on o.product_id = p.id
group by p.id;
