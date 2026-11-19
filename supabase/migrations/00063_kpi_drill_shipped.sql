-- STATS-2-F: drill metric 'shipped' = the orders behind kpi_group_extras.shipped (00060 `sh`):
-- swapped, or delivered/returned, or cancelled after pickup. Same body as 00061 plus that case.
-- Signature, security invoker, is_admin() gate and grants unchanged.
create or replace function public.kpi_drill_orders(
  p_metric text, p_from date default null, p_to date default null, p_product uuid[] default null,
  p_wilaya int default null, p_commune_key text default null, p_unknown boolean default false,
  p_delivery_type text default null, p_offset int default 0, p_limit int default 25,
  p_filters jsonb default null
) returns table (id uuid, total bigint)
language sql stable security invoker set search_path = public as $$
  with m as (
    select o.id, o.created_at
      from public.orders o
     where public.is_admin()
       and o.id in (select k.id from public.kpi_order_set(p_from, p_to, p_product, p_filters) k)
       and (p_wilaya is null or o.wilaya_code = p_wilaya)
       and (p_delivery_type is null or o.delivery_type::text = p_delivery_type)
       and (case when p_unknown then nullif(lower(trim(o.commune)), '') is null
                 when p_commune_key is not null then nullif(lower(trim(o.commune)), '') = p_commune_key
                 else true end)
       and case p_metric
             when 'received' then not exists (select 1 from public.orders r
                    where r.swapped_to_order_id = o.id and r.workspace_id = o.workspace_id)
             when 'confirmed' then o.confirmation_status = 'confirmed' and not exists (select 1 from public.orders r
                    where r.swapped_to_order_id = o.id and r.workspace_id = o.workspace_id)
             when 'delivered' then o.delivery_status = 'delivered' and o.swapped_to_order_id is null
             when 'returned' then o.delivery_status = 'returned' and o.swapped_to_order_id is null
             when 'return' then (o.delivery_status = 'returned' and o.swapped_to_order_id is null)
                                or o.swapped_to_order_id is not null
             when 'shipped' then o.swapped_to_order_id is not null
                                or o.delivery_status in ('delivered', 'returned')
                                or (o.delivery_status = 'cancelled' and (
                                      exists (select 1 from public.zr_shipments z where z.order_id = o.id)
                                      or exists (select 1 from public.order_status_history h
                                                  where h.order_id = o.id and h.stage = 'delivery'
                                                    and h.to_status in ('bureau_deposited', 'in_transit', 'out_for_delivery',
                                                                        'stop_desk_waiting', 'delayed', 'returning'))))
             else false end
  )
  select m.id, (select count(*) from m)
    from m order by m.created_at desc, m.id
   offset greatest(p_offset, 0) limit least(greatest(p_limit, 0), 100);
$$;

revoke execute on function public.kpi_drill_orders(text, date, date, uuid[], int, text, boolean, text, int, int, jsonb) from public, anon;
grant execute on function public.kpi_drill_orders(text, date, date, uuid[], int, text, boolean, text, int, int, jsonb) to authenticated;
