-- STATS-1 (D98): history and risk use the caller's order visibility. Only the
-- detail view calculates the KPI cohort, so customer lists stay lightweight.
create or replace view public.customer_stats
with (security_invoker = true) as
with ranked_history as (
  select c.id, c.workspace_id, c.name, c.phone, c.wilaya_code, c.commune,
         o.id as order_id, o.confirmation_status, o.delivery_status,
         coalesce(o.placed_at, o.created_at) as order_at,
         row_number() over (partition by c.id
           order by coalesce(o.placed_at, o.created_at) desc, o.id desc) as newest_rank
  from public.customers c
  left join public.orders o on o.customer_id = c.id and o.workspace_id = c.workspace_id
), history as (
  select id, workspace_id, name, phone, wilaya_code, commune,
         count(order_id) as total_orders,
         count(*) filter (where confirmation_status = 'confirmed') as confirmed_orders,
         count(*) filter (where delivery_status = 'delivered') as delivered_orders,
         count(*) filter (where delivery_status = 'returned') as returned_orders,
         count(*) filter (where confirmation_status = 'cancelled') as cancelled_orders,
         count(*) filter (where confirmation_status in ('no_answer', 'closed_phone')) as no_answer_orders,
         min(order_at) as first_order_at, max(order_at) as last_order_at,
         (max(confirmation_status::text) filter (where newest_rank = 1))::public.confirmation_status as last_confirmation_status,
         (max(delivery_status::text) filter (where newest_rank = 1))::public.delivery_status as last_delivery_status
  from ranked_history
  group by id, workspace_id, name, phone, wilaya_code, commune
)
select h.id, h.workspace_id, h.name, h.phone, h.wilaya_code, h.commune,
       h.total_orders, h.confirmed_orders, h.delivered_orders,
       h.returned_orders, h.cancelled_orders, h.no_answer_orders,
       risk.score as risk_score,
       case when (select public.is_admin()) then 'workspace' else 'visible' end as history_scope,
       case when h.total_orders = 0 then 'new'
            when risk.score is null then 'unscored'
            when risk.score = 0 then 'neutral'
            when risk.score < 30 then 'warning'
            else 'high' end as risk_state,
       case when h.total_orders = 0 then 'no_history'
            when risk.score is null then 'unscored'
            when greatest(points.returned, points.cancelled, points.no_answer) = 0 then 'no_adverse_signal'
            when points.returned >= greatest(points.cancelled, points.no_answer) then 'returned'
            when points.cancelled >= points.no_answer then 'cancelled'
            else 'no_answer' end as risk_reason,
       h.first_order_at, h.last_order_at, h.last_confirmation_status, h.last_delivery_status
from history h
left join public.settings s
  on s.workspace_id = h.workspace_id and s.key = 'risk_weights' and (select public.is_admin())
cross join lateral (
  select case when jsonb_typeof(s.value->'returned') = 'number'
              then (s.value->>'returned')::numeric else 2 end as returned,
         case when jsonb_typeof(s.value->'cancelled') = 'number'
              then greatest((s.value->>'cancelled')::numeric, 0) else 1 end as cancelled,
         case when jsonb_typeof(s.value->'no_answer') = 'number'
              then greatest((s.value->>'no_answer')::numeric, 0) else 0.5 end as no_answer
) weights
cross join lateral (
  select weights.returned * h.returned_orders as returned,
         weights.cancelled * h.cancelled_orders as cancelled,
         weights.no_answer * h.no_answer_orders as no_answer
) points
cross join lateral (
  select case when h.total_orders > 0 and weights.returned > 0 then
           least(100, round(100 * (points.returned + points.cancelled + points.no_answer)
                            / (weights.returned * h.total_orders)))
         end as score
) risk;

create view public.customer_delivery_stats
with (security_invoker = true) as
with cohort as materialized (
  select id from public.kpi_order_set(null, null, null, null)
), eligible as (
  select c.workspace_id, c.id as customer_id, array_agg(o.id) filter (where o.id is not null) as ids,
         sum(o.sale_price * o.quantity) filter (where (select public.is_admin())
           and o.delivery_status = 'delivered' and o.swapped_to_order_id is null) as delivered_value
  from public.customers c
  left join public.orders o on o.customer_id = c.id and o.workspace_id = c.workspace_id
    and o.id in (select id from cohort)
  group by c.id
)
select e.workspace_id, e.customer_id,
       (k.rates->'delivery'->>'num')::int as delivery_numerator,
       (k.rates->'delivery'->>'den')::int as delivery_denominator,
       case when (k.rates->'delivery'->>'matured')::boolean
            then (k.rates->'delivery'->>'value')::numeric end as delivery_value,
       (k.rates->'delivery'->>'matured')::boolean as delivery_matured,
       case when (select public.is_admin()) then coalesce(e.delivered_value, 0) end as lifetime_delivered_value_dzd
from eligible e
cross join lateral public.kpi_rates(coalesce(e.ids, '{}'::uuid[])) k(rates);

create view public.customer_product_stats
with (security_invoker = true) as
select o.workspace_id, o.customer_id, o.product_id, count(*) as order_count
from public.orders o
join public.customers c on c.id = o.customer_id and c.workspace_id = o.workspace_id
where o.product_id is not null
group by o.workspace_id, o.customer_id, o.product_id;

revoke all on public.customer_stats, public.customer_delivery_stats, public.customer_product_stats
  from public, anon, authenticated;
grant select on public.customer_stats, public.customer_delivery_stats, public.customer_product_stats
  to authenticated;
