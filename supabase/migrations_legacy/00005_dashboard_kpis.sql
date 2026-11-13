-- ============================================================================
-- MNW COD ERP — dashboard_kpis() (Phase 8)
-- File: supabase/migrations/00005_dashboard_kpis.sql
--
-- One round-trip dashboard read. SECURITY INVOKER so every inner query respects
-- the caller's RLS (admins see global, agents see only their scoped orders).
-- Time-based metrics come from order_events (status transitions carry the
-- timestamp); current-state queue counts come from orders.
-- ============================================================================

create or replace function public.dashboard_kpis()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'today', jsonb_build_object(
      'confirmed', coalesce((select count(distinct e.order_id) from public.order_events e
        where e.stage='confirmation' and e.status='confirmed' and e.created_at >= current_date), 0),
      'delivered', coalesce((select count(distinct e.order_id) from public.order_events e
        where e.stage='delivery' and e.status='delivered' and e.created_at >= current_date), 0),
      'returned',  coalesce((select count(distinct e.order_id) from public.order_events e
        where e.stage='delivery' and e.status='returned' and e.created_at >= current_date), 0),
      'revenue',   coalesce((select sum(o.total_amount) from public.orders o
        where o.delivery_status='delivered'
          and exists (select 1 from public.order_events e where e.order_id=o.id
                      and e.stage='delivery' and e.status='delivered' and e.created_at >= current_date)), 0)
    ),
    'month', jsonb_build_object(
      'confirmed', coalesce((select count(distinct e.order_id) from public.order_events e
        where e.stage='confirmation' and e.status='confirmed' and e.created_at >= date_trunc('month', now())), 0),
      'delivered', coalesce((select count(distinct e.order_id) from public.order_events e
        where e.stage='delivery' and e.status='delivered' and e.created_at >= date_trunc('month', now())), 0),
      'returned',  coalesce((select count(distinct e.order_id) from public.order_events e
        where e.stage='delivery' and e.status='returned' and e.created_at >= date_trunc('month', now())), 0),
      'revenue',   coalesce((select sum(o.total_amount) from public.orders o
        where o.delivery_status='delivered'
          and exists (select 1 from public.order_events e where e.order_id=o.id
                      and e.stage='delivery' and e.status='delivered' and e.created_at >= date_trunc('month', now()))), 0)
    ),
    'queue', jsonb_build_object(
      'pending_confirmation', coalesce((select count(*) from public.orders
        where confirmation_status='wait_for_confirmation'), 0),
      'awaiting_delivery',    coalesce((select count(*) from public.orders
        where confirmation_status='confirmed' and delivery_status not in ('delivered','cancelled')), 0)
    ),
    'top_product', (select jsonb_build_object('name', p.name, 'delivered', count(*))
      from public.orders o join public.products p on p.id = o.product_id
      where o.delivery_status='delivered' and o.placed_at >= date_trunc('month', now())
      group by p.name order by count(*) desc limit 1),
    'totals', jsonb_build_object(
      'products',  coalesce((select count(*) from public.products), 0),
      'orders',    coalesce((select count(*) from public.orders), 0),
      'customers', coalesce((select count(*) from public.contacts where type='customer'), 0)
    )
  );
$$;

grant execute on function public.dashboard_kpis() to authenticated;
