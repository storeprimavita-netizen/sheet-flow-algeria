-- CHART-1 review fixes: one range check for every chart RPC, kpi_daily window that still sums to
-- pnl_lines past 366 days (last 366 days, same window for the money), whole-cent fixed fees,
-- and drill metrics that match the chart counts (outcomes, weekday, hour).

create or replace function public.chart_range_ok(p_from date, p_to date) returns boolean
language plpgsql immutable set search_path = public as $$
begin
  if p_from is not null and p_to is not null and p_from > p_to then
    raise exception 'chart range: p_from is after p_to' using errcode = '22023';
  end if;
  return true;
end; $$;
revoke execute on function public.chart_range_ok(date, date) from public, anon;
grant execute on function public.chart_range_ok(date, date) to authenticated;

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
  v_fixed numeric; v_fee numeric; v_cents bigint; v_base bigint; v_extra bigint;
begin
  if not public.is_admin() then return; end if;
  perform public.chart_range_ok(p_from, p_to);
  v_ids := array(select k.id from public.kpi_order_set(p_from, p_to, p_product, p_filters) k);
  v_pnl := public.pnl_lines(v_ids, p_from, p_to, p_product, v_has_filters);
  v_from := (v_pnl->>'period_from')::date;
  v_to := (v_pnl->>'period_to')::date;
  v_days := (v_pnl->>'days')::int;
  if v_days > 366 then
    -- longer than 366 days: the series is the LAST 366 days and every money figure is
    -- pnl_lines of that same window, so the days still sum exactly to a period total
    v_from := v_to - 365;
    v_ids := array(select k.id from public.kpi_order_set(v_from, v_to, p_product, p_filters) k);
    v_pnl := public.pnl_lines(v_ids, v_from, v_to, p_product, v_has_filters);
    v_days := (v_pnl->>'days')::int;
  end if;
  v_fixed := (v_pnl->>'fixed_fees')::numeric;
  v_fee := (v_pnl->>'return_fee_unit')::numeric;
  v_cents := round(v_fixed * 100)::bigint;
  v_base := v_cents / greatest(v_days, 1);
  v_extra := v_cents % greatest(v_days, 1);

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
           (v_base + case when (g.day - v_from) < v_extra then 1 else 0 end)::numeric / 100 as fixed
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


create or replace function public.kpi_by_weekday_hour(
  p_from date default null, p_to date default null, p_product uuid[] default null,
  p_filters jsonb default null
) returns table (kind text, bucket int, rates jsonb)
language sql stable security invoker set search_path = public as $$
  with s as (
    select o.id, (coalesce(o.placed_at, o.created_at) at time zone 'Africa/Algiers') as ts
      from public.orders o
     where public.is_admin() and public.chart_range_ok(p_from, p_to)
       and o.id in (select k.id from public.kpi_order_set(p_from, p_to, p_product, p_filters) k)
  ), g as (
    select 'weekday'::text as kind, extract(isodow from ts)::int as bucket, array_agg(id) as ids from s group by 2
    union all
    select 'hour'::text, extract(hour from ts)::int, array_agg(id) from s group by 2
  )
  select g.kind, g.bucket, public.kpi_rates(g.ids) from g;
$$;

create or replace function public.kpi_by_product(
  p_from date default null, p_to date default null, p_product uuid[] default null,
  p_filters jsonb default null
) returns table (product_id uuid, product_name text, rates jsonb)
language sql stable security invoker set search_path = public as $$
  with g as (
    select o.product_id, array_agg(o.id) as ids
      from public.orders o
     where public.is_admin() and public.chart_range_ok(p_from, p_to)
       and o.id in (select k.id from public.kpi_order_set(p_from, p_to, p_product, p_filters) k)
     group by o.product_id
  )
  select g.product_id, p.name, public.kpi_rates(g.ids)
    from g
    left join public.products p on p.id = g.product_id;
$$;

-- the one outcome CASE (kpi_outcomes counts it, kpi_drill_orders lists it)
create or replace function public.order_outcome(p_swapped uuid, p_delivery text, p_confirmation text)
returns text language sql immutable set search_path = public as $$
  select case
           when p_swapped is not null then 'returned'
           when p_delivery = 'delivered' then 'delivered'
           when p_delivery = 'returned' then 'returned'
           when p_confirmation in ('cancelled', 'closed_phone') or p_delivery = 'cancelled' then 'cancelled'
           when p_confirmation in ('wait_for_confirmation', 'no_answer') then 'unconfirmed'
           else 'in_progress'
         end;
$$;
revoke execute on function public.order_outcome(uuid, text, text) from public, anon;
grant execute on function public.order_outcome(uuid, text, text) to authenticated;

create or replace function public.kpi_outcomes(
  p_from date default null, p_to date default null, p_product uuid[] default null,
  p_filters jsonb default null
) returns table (outcome text, n int)
language sql stable security invoker set search_path = public as $$
  select public.order_outcome(o.swapped_to_order_id, o.delivery_status::text, o.confirmation_status::text) as outcome,
         count(*)::int
    from public.orders o
   where public.is_admin() and public.chart_range_ok(p_from, p_to)
     and o.id in (select k.id from public.kpi_order_set(p_from, p_to, p_product, p_filters) k)
     and not exists (select 1 from public.orders r
                      where r.swapped_to_order_id = o.id and r.workspace_id = o.workspace_id)
   group by 1;
$$;

-- kpi_drill_orders (00061) + metrics out_<outcome> (the donut slices) and the drill-only
-- p_filters keys weekday (ISO 1-7) and hour (0-23), Africa/Algiers like the charts.
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
     where public.is_admin() and public.chart_range_ok(p_from, p_to)
       and o.id in (select k.id from public.kpi_order_set(p_from, p_to, p_product,
                      nullif(coalesce(p_filters, '{}'::jsonb) - 'weekday' - 'hour', '{}'::jsonb)) k)
       and (p_wilaya is null or o.wilaya_code = p_wilaya)
       and (p_delivery_type is null or o.delivery_type::text = p_delivery_type)
       and (p_filters is null or not (p_filters ? 'weekday')
            or extract(isodow from (coalesce(o.placed_at, o.created_at) at time zone 'Africa/Algiers'))::int = (p_filters ->> 'weekday')::int)
       and (p_filters is null or not (p_filters ? 'hour')
            or extract(hour from (coalesce(o.placed_at, o.created_at) at time zone 'Africa/Algiers'))::int = (p_filters ->> 'hour')::int)
       and (case when p_unknown then nullif(lower(trim(o.commune)), '') is null
                 when p_commune_key is not null then nullif(lower(trim(o.commune)), '') = p_commune_key
                 else true end)
       and case
             when p_metric = 'received' then not exists (select 1 from public.orders r
                    where r.swapped_to_order_id = o.id and r.workspace_id = o.workspace_id)
             when p_metric = 'confirmed' then o.confirmation_status = 'confirmed' and not exists (select 1 from public.orders r
                    where r.swapped_to_order_id = o.id and r.workspace_id = o.workspace_id)
             when p_metric = 'delivered' then o.delivery_status = 'delivered' and o.swapped_to_order_id is null
             when p_metric = 'returned' then o.delivery_status = 'returned' and o.swapped_to_order_id is null
             when p_metric = 'return' then (o.delivery_status = 'returned' and o.swapped_to_order_id is null)
                                or o.swapped_to_order_id is not null
             when p_metric like 'out\_%' then not exists (select 1 from public.orders r
                    where r.swapped_to_order_id = o.id and r.workspace_id = o.workspace_id)
                    and public.order_outcome(o.swapped_to_order_id, o.delivery_status::text, o.confirmation_status::text)
                        = substr(p_metric, 5)
             else false end
  )
  select m.id, (select count(*) from m)
    from m order by m.created_at desc, m.id
   offset greatest(p_offset, 0) limit least(greatest(p_limit, 0), 100);
$$;
