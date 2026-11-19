-- STATS-2 (D4, D46, D47, D64): per-wilaya and per-commune rates for /app/statistics.
-- Same order set as everything else (kpi_order_set) and the same rates
-- (kpi_rates) per group; nothing is re-derived. security invoker, admin-only:
-- both functions return zero rows unless public.is_admin() (D64). No money keys.

-- Extras that kpi_rates does not carry, for one group of order ids.
--   shipped = the delivery-rate denominator set (delivered/returned non-swapped,
--   cancelled-after-pickup non-swapped, swap originals) so home + stopdesk = shipped.
--   avg_days = delivered non-swapped, from coalesce(placed_at, created_at) to the
--   delivery history entry 'delivered'; null when none.
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
     where o.id = any (p_order_ids) and o.workspace_id = public.current_workspace_id()
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

-- One row per wilaya of the set. rates = kpi_rates(ids of the wilaya).
create or replace function public.kpi_by_wilaya(
  p_from date default null, p_to date default null, p_product uuid[] default null
) returns table (
  wilaya_code smallint, wilaya_name text, rates jsonb, extras jsonb
)
language sql stable security invoker set search_path = public as $$
  with g as (
    select o.wilaya_code, array_agg(o.id) as ids
      from public.orders o
     where public.is_admin()
       and o.id in (select k.id from public.kpi_order_set(p_from, p_to, p_product) k)
     group by o.wilaya_code
  )
  select g.wilaya_code, wl.name, public.kpi_rates(g.ids), public.kpi_group_extras(g.ids)
    from g
    left join public.wilayas wl on wl.code = g.wilaya_code;
$$;

-- One row per commune of one wilaya. commune_key = nullif(lower(trim(commune)),'')
-- (null = unknown); commune = deterministic display spelling (mode, then min).
create or replace function public.kpi_by_commune(
  p_wilaya int, p_from date default null, p_to date default null, p_product uuid[] default null
) returns table (
  commune_key text, commune text, rates jsonb, extras jsonb
)
language sql stable security invoker set search_path = public as $$
  with s as (
    select o.id, nullif(lower(trim(o.commune)), '') as k, nullif(trim(o.commune), '') as c
      from public.orders o
     where public.is_admin()
       and o.wilaya_code = p_wilaya
       and o.id in (select x.id from public.kpi_order_set(p_from, p_to, p_product) x)
  ), g as (
    select k, array_agg(id) as ids,
           (mode() within group (order by c)) as shown
      from s group by k
  )
  select g.k, g.shown, public.kpi_rates(g.ids), public.kpi_group_extras(g.ids) from g;
$$;

revoke execute on function public.kpi_group_extras(uuid[]) from public, anon;
revoke execute on function public.kpi_by_wilaya(date, date, uuid[]) from public, anon;
revoke execute on function public.kpi_by_commune(int, date, date, uuid[]) from public, anon;
grant execute on function public.kpi_group_extras(uuid[]) to authenticated;
grant execute on function public.kpi_by_wilaya(date, date, uuid[]) to authenticated;
grant execute on function public.kpi_by_commune(int, date, date, uuid[]) to authenticated;
