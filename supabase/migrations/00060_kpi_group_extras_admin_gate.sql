-- STATS-2 review fix (D64): kpi_group_extras was callable by any authenticated role, so an
-- agent could read shipped/home/stop-desk/avg-days over the orders RLS lets them see.
-- Same body as 00058 plus an is_admin() gate (zeros for non-admins; its only callers,
-- kpi_by_wilaya / kpi_by_commune, already return nothing to them).
create or replace function public.kpi_group_extras(p_order_ids uuid[])
returns jsonb
language sql stable security invoker set search_path = public as $$
  with s as (
    select o.delivery_type,
           (o.swapped_to_order_id is not null) as swapped,
           o.delivery_status,
           (o.delivery_status = 'cancelled' and (
              exists (select 1 from public.zr_shipments z where z.order_id = o.id)
              or exists (select 1 from public.order_status_history h
                          where h.order_id = o.id and h.stage = 'delivery'
                            and h.to_status in ('bureau_deposited', 'in_transit', 'out_for_delivery',
                                                'stop_desk_waiting', 'delayed', 'returning')))) as after_pickup,
           (select max(h.created_at) from public.order_status_history h
             where h.order_id = o.id and h.stage = 'delivery' and h.to_status = 'delivered') as delivered_at,
           coalesce(o.placed_at, o.created_at) as born
      from public.orders o
     where public.is_admin() and o.id = any (p_order_ids) and o.workspace_id = public.current_workspace_id()
  ), sh as (
    select * from s
     where swapped or delivery_status in ('delivered', 'returned') or after_pickup
  )
  select jsonb_build_object(
    'shipped',         (select count(*) from sh),
    'home_count',      (select count(*) from sh where delivery_type = 'home'),
    'stopdesk_count',  (select count(*) from sh where delivery_type = 'stopdesk'),
    'avg_days_to_deliver',
      (select round((avg(extract(epoch from (delivered_at - born)) / 86400))::numeric, 1)
         from s where delivery_status = 'delivered' and not swapped and delivered_at is not null),
    'avg_days_sample',
      (select count(*) from s where delivery_status = 'delivered' and not swapped and delivered_at is not null));
$$;

grant execute on function public.kpi_group_extras(uuid[]) to authenticated;
