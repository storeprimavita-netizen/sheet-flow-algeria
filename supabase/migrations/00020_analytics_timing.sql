-- 14g: timing stats. Extend agent_performance with avg delivery/total time
-- and add a workspace-level timing view. security_invoker like all 00006 views.

-- create or replace may only APPEND columns — original column order kept,
-- the two new ones go last.
create or replace view public.agent_performance
with (security_invoker = true) as
select o.workspace_id, h.actor as user_id, h.stage,
       count(distinct h.order_id)                                      as orders_handled,
       count(*) filter (where h.to_status = 'confirmed')               as confirmed,
       count(*) filter (where h.to_status = 'delivered')               as delivered,
       count(*) filter (where h.to_status in ('cancelled','returned')) as lost,
       avg(h.created_at - o.created_at)
         filter (where h.to_status in ('confirmed','cancelled'))       as avg_decision_time,
       avg(h.created_at - conf.confirmed_at)
         filter (where h.to_status = 'delivered' and conf.confirmed_at is not null)
                                                                       as avg_delivery_time,
       avg(h.created_at - o.created_at)
         filter (where h.to_status = 'delivered')                       as avg_total_time
from public.order_status_history h
join public.orders o on o.id = h.order_id
left join lateral (
  select max(c.created_at) as confirmed_at
  from public.order_status_history c
  where c.order_id = h.order_id
    and c.stage = 'confirmation'
    and c.to_status = 'confirmed'
    and c.created_at <= h.created_at
) conf on true
where h.actor is not null
group by o.workspace_id, h.actor, h.stage;

-- Same three timings, workspace-wide (no actor filter: service-role/webhook
-- transitions are real elapsed time; timing is about orders, not credit).
create view public.workspace_performance
with (security_invoker = true) as
select o.workspace_id,
       avg(h.created_at - o.created_at)
         filter (where h.to_status in ('confirmed','cancelled'))       as avg_decision_time,
       avg(h.created_at - conf.confirmed_at)
         filter (where h.to_status = 'delivered' and conf.confirmed_at is not null)
                                                                       as avg_delivery_time,
       avg(h.created_at - o.created_at)
         filter (where h.to_status = 'delivered')                       as avg_total_time
from public.order_status_history h
join public.orders o on o.id = h.order_id
left join lateral (
  select max(c.created_at) as confirmed_at
  from public.order_status_history c
  where c.order_id = h.order_id
    and c.stage = 'confirmation'
    and c.to_status = 'confirmed'
    and c.created_at <= h.created_at
) conf on true
group by o.workspace_id;
