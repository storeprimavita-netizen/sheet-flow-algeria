-- STATS-3: seasons (named date ranges per year) + ONE filter set for Statistics.
-- (1) seasons / season_periods, admin-only RLS. (2) kpi_order_set gains p_filters
-- (whitelisted keys, text comparison, never casts user values, malformed = zero rows).
-- (3) kpi_by_wilaya / kpi_by_commune / kpi_drill_orders pass p_filters through; OLD
-- signatures are dropped (else PostgREST PGRST203). (4) kpi_set_rates: rates of one
-- filtered set without shipping ids through the API (max_rows cap).

create table public.seasons (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name         text not null check (btrim(name) <> ''),
  name_key     text,                       -- stable key for the 6 seeded names (messages map it)
  sort         int  not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (workspace_id, name),
  unique (id, workspace_id)
);
create index seasons_workspace_idx on public.seasons (workspace_id);

-- year = year of date_from (a winter crossing New Year belongs to the year it starts)
create table public.season_periods (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  season_id    uuid not null,
  year         int  not null check (year between 2000 and 2100),
  date_from    date not null,
  date_to      date not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (date_from <= date_to),
  check (extract(year from date_from)::int = year),
  unique (season_id, year),
  foreign key (season_id, workspace_id) references public.seasons (id, workspace_id) on delete cascade
);
create index season_periods_workspace_idx on public.season_periods (workspace_id);

create or replace function public.seasons_workspace_immutable()
returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if new.workspace_id is distinct from old.workspace_id then
    raise exception 'workspace_id cannot change';
  end if;
  return new;
end; $$;

do $$
declare t text;
begin
  foreach t in array array['seasons','season_periods'] loop
    execute format('create trigger workspace_immutable before update on public.%I '
                   'for each row execute function public.seasons_workspace_immutable();', t);
    execute format('create trigger set_updated_at before update on public.%I '
                   'for each row execute function public.set_updated_at();', t);
    execute format('create trigger audit after insert or update or delete on public.%I '
                   'for each row execute function public.audit_row();', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke truncate, trigger, references on public.%I from authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated '
      'using (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()))', t || '_sel', t);
    execute format('create policy %I on public.%I for insert to authenticated '
      'with check (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()))', t || '_ins', t);
    execute format('create policy %I on public.%I for update to authenticated '
      'using (workspace_id = (select public.current_workspace_id()) and (select public.is_admin())) '
      'with check (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()))', t || '_upd', t);
    execute format('create policy %I on public.%I for delete to authenticated '
      'using (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()))', t || '_del', t);
  end loop;
end; $$;
revoke all on function public.seasons_workspace_immutable() from public, anon, authenticated;

-- seed_workspace: full 00014 body + the six season names
create or replace function public.seed_workspace(p_ws uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_set_id uuid;
begin
  insert into public.wilaya_fees (workspace_id, wilaya_code)
  select p_ws, code from public.wilayas
  on conflict do nothing;

  insert into public.settings (workspace_id, key, value) values
    (p_ws, 'return_fee',         '{"amount": 150}'),
    (p_ws, 'duplicate_window',   '{"hours": 48}'),
    (p_ws, 'risk_weights',       '{"returned": 2, "cancelled": 1, "no_answer": 0.5}'),
    (p_ws, 'stop_shipping_rule', '{"min_orders": 10, "min_delivery_rate": 40}'),
    (p_ws, 'meeting_schedule',   '{"slots": [{"dow": 1, "time": "20:00"}, {"dow": 4, "time": "20:00"}]}')
  on conflict do nothing;

  if not exists (select 1 from public.option_sets where workspace_id = p_ws and key = 'product_category') then
    insert into public.option_sets (workspace_id, key, label, allows_multi) values
      (p_ws, 'product_category',   'Product category',  false),
      (p_ws, 'product_fabric',     'Fabric',             false),
      (p_ws, 'expense_subcategory','Expense subcategory',false),
      (p_ws, 'order_tag',          'Tags',               true),
      (p_ws, 'cancellation_reason','Cancellation reason',false);

    select id into v_set_id from public.option_sets where workspace_id = p_ws and key = 'product_category';
    insert into public.options (workspace_id, set_id, label, color_token, sort_order) values
      (p_ws, v_set_id, 'Robes',      'violet', 0),
      (p_ws, v_set_id, 'Ensembles',  'cyan',   1),
      (p_ws, v_set_id, 'Abayas',     'indigo', 2),
      (p_ws, v_set_id, 'Jupes',      'orange', 3),
      (p_ws, v_set_id, 'Vestes',     'rose',   4),
      (p_ws, v_set_id, 'Accessoires','info',   5);

    select id into v_set_id from public.option_sets where workspace_id = p_ws and key = 'product_fabric';
    insert into public.options (workspace_id, set_id, label, color_token, sort_order) values
      (p_ws, v_set_id, 'Soie',      'violet', 0),
      (p_ws, v_set_id, 'Coton',     'cyan',   1),
      (p_ws, v_set_id, 'Crêpe',     'indigo', 2),
      (p_ws, v_set_id, 'Denim',     'orange', 3),
      (p_ws, v_set_id, 'Laine',     'rose',   4),
      (p_ws, v_set_id, 'Satin',     'info',   5),
      (p_ws, v_set_id, 'Mousseline','warning',6);

    select id into v_set_id from public.option_sets where workspace_id = p_ws and key = 'expense_subcategory';
    insert into public.options (workspace_id, set_id, label, color_token, sort_order) values
      (p_ws, v_set_id, 'Location studio',    'violet', 0),
      (p_ws, v_set_id, 'Mannequin',          'cyan',   1),
      (p_ws, v_set_id, 'Transport',          'orange', 2),
      (p_ws, v_set_id, 'Fournitures',        'info',   3),
      (p_ws, v_set_id, 'Autre',              'neutral',4);

    select id into v_set_id from public.option_sets where workspace_id = p_ws and key = 'order_tag';
    insert into public.options (workspace_id, set_id, label, color_token, sort_order) values
      (p_ws, v_set_id, 'VIP',           'success', 0),
      (p_ws, v_set_id, 'Risque élevé',  'danger',  1),
      (p_ws, v_set_id, 'Test',          'warning', 2),
      (p_ws, v_set_id, 'Grossiste',     'indigo',  3);

    select id into v_set_id from public.option_sets where workspace_id = p_ws and key = 'cancellation_reason';
    insert into public.options (workspace_id, set_id, label, color_token, sort_order) values
      (p_ws, v_set_id, 'A changé d''avis',        'neutral', 0),
      (p_ws, v_set_id, 'Trouvé moins cher',       'warning', 1),
      (p_ws, v_set_id, 'Commande en double',      'orange',  2),
      (p_ws, v_set_id, 'Numéro injoignable',      'rose',    3),
      (p_ws, v_set_id, 'Plus besoin',             'neutral', 4),
      (p_ws, v_set_id, 'Autre',                   'neutral', 5);
  end if;

  -- STATS-3: season names (no dates guessed); idempotent
  insert into public.seasons (workspace_id, name, name_key, sort) values
    (p_ws, 'Ramadan',        'ramadan',       0),
    (p_ws, 'Eid al-Fitr',    'eid_al_fitr',   1),
    (p_ws, 'Eid al-Adha',    'eid_al_adha',   2),
    (p_ws, 'Summer',         'summer',        3),
    (p_ws, 'Back to school', 'back_to_school',4),
    (p_ws, 'Winter',         'winter',        5)
  on conflict (workspace_id, name) do nothing;
end; $$;

-- existing workspaces get the six names too (idempotent)
do $$
declare w record;
begin
  for w in select id from public.workspaces loop
    perform public.seed_workspace(w.id);
  end loop;
end; $$;

-- ---------------------------------------------------------------------------
-- kpi_order_set with p_filters. Keys: category (option uuid text), wilaya,
-- source, agent (assigned_confirmation_agent), delivery_type. Values are compared
-- as TEXT, never cast. null / '{}' = no filter; non-object, unknown key, non-string
-- value = zero rows (never throws).
-- ---------------------------------------------------------------------------
create or replace function public.kpi_order_set(
  p_from date default null, p_to date default null, p_product uuid[] default null,
  p_filters jsonb default null
) returns table (id uuid)
language sql stable security invoker set search_path = public as $$
  select o.id
    from public.orders o
   where o.workspace_id = public.current_workspace_id()
     and (p_from is null or (coalesce(o.placed_at, o.created_at) at time zone 'Africa/Algiers')::date >= p_from)
     and (p_to   is null or (coalesce(o.placed_at, o.created_at) at time zone 'Africa/Algiers')::date <= p_to)
     and (p_product is null or o.product_id = any (p_product))
     and o.excluded_reason is null
     and not (o.is_duplicate_suspect and o.confirmation_status <> 'confirmed')
     and coalesce(case
           when p_filters is null or p_filters = '{}'::jsonb then true
           when jsonb_typeof(p_filters) <> 'object' then false
           when exists (select 1 from jsonb_each(p_filters) e
                         where e.key not in ('category', 'wilaya', 'source', 'agent', 'delivery_type')
                            or jsonb_typeof(e.value) <> 'string') then false
           else (not (p_filters ? 'category') or exists (
                    select 1 from public.products p
                     where p.id = o.product_id and p.category_option_id::text = p_filters ->> 'category'))
            and (not (p_filters ? 'wilaya')        or o.wilaya_code::text = p_filters ->> 'wilaya')
            and (not (p_filters ? 'source')        or o.source::text = p_filters ->> 'source')
            and (not (p_filters ? 'agent')         or o.assigned_confirmation_agent::text = p_filters ->> 'agent')
            and (not (p_filters ? 'delivery_type') or o.delivery_type::text = p_filters ->> 'delivery_type')
         end, false);
$$;

-- wilaya_stats / product_stats (00031) depend on the old signature: same bodies, 4-arg call,
-- so the old function can be dropped.
create or replace view public.wilaya_stats
with (security_invoker = true) as
with rule as (
  select w.id as workspace_id,
         coalesce((s.value->>'min_orders')::int, 10)             as min_orders,
         coalesce((s.value->>'min_delivery_rate')::numeric, 40)  as min_rate
  from public.workspaces w
  left join public.settings s
    on s.workspace_id = w.id and s.key = 'stop_shipping_rule'
), g as (
  select o.workspace_id, o.wilaya_code, count(*) as total_orders, array_agg(o.id) as ids
  from public.orders o
  where o.id in (select k.id from public.kpi_order_set(null, null, null, null) k)
  group by o.workspace_id, o.wilaya_code
)
select g.workspace_id, g.wilaya_code, wl.name as wilaya_name,
       g.total_orders,
       (k.r->'counts'->>'confirmed')::bigint as confirmed_orders,
       (k.r->'counts'->>'delivered')::bigint as delivered_orders,
       (k.r->'counts'->>'returned')::bigint  as returned_orders,
       round(100 * (k.r->'delivery'->>'value')::numeric, 1) as delivery_rate,
       coalesce(wf.stop_shipping, false) as stop_shipping_manual,
       coalesce((k.r->'delivery'->>'matured')::boolean
                and (k.r->'delivery'->>'den')::int >= r.min_orders
                and 100 * (k.r->'delivery'->>'value')::numeric < r.min_rate, false) as stop_shipping_auto
from g
join rule r on r.workspace_id = g.workspace_id
cross join lateral (select public.kpi_rates(g.ids) as r) k
left join public.wilayas wl on wl.code = g.wilaya_code
left join public.wilaya_fees wf
  on wf.workspace_id = g.workspace_id and wf.wilaya_code = g.wilaya_code;

create or replace view public.product_stats
with (security_invoker = true) as
select p.id, p.workspace_id, p.name, p.status, p.stock,
       (k.r->'counts'->>'received')::bigint  as orders_received,
       (k.r->'counts'->>'confirmed')::bigint as orders_confirmed,
       (k.r->'counts'->>'delivered')::bigint as orders_delivered,
       (k.r->'counts'->>'returned')::bigint  as orders_returned,
       round(100 * (k.r->'confirmation'->>'value')::numeric, 1) as confirmation_rate,
       round(100 * (k.r->'delivery'->>'value')::numeric, 1)     as delivery_rate,
       (select sum(o.sale_price * o.quantity) from public.orders o
         where o.id = any (g.ids) and o.delivery_status = 'delivered' and o.swapped_to_order_id is null) as revenue_dzd,
       (select sum(e.amount_dzd) from public.expenses e where e.product_id = p.id)   as expenses_dzd,
       (select sum(a.amount_dzd) from public.ad_spend_daily a where a.product_id = p.id) as ad_spend_dzd,
       (select pc.sourcing_cost_dzd from public.product_costs pc where pc.product_id = p.id) as sourcing_cost_dzd
from public.products p
cross join lateral (
  select coalesce(array_agg(o.id), '{}'::uuid[]) as ids
  from public.orders o
  where o.product_id = p.id
    and o.id in (select s.id from public.kpi_order_set(null, null, null, null) s)
) g
cross join lateral (select public.kpi_rates(g.ids) as r) k;

-- other kpi_order_set callers (kpi_lines, dashboard_stats, pnl_*, kpi_summary) call it
-- with 3 args: the default keeps them working. Drop the old signatures only now.
drop function public.kpi_by_wilaya(date, date, uuid[]);
drop function public.kpi_by_commune(int, date, date, uuid[]);
drop function public.kpi_drill_orders(text, date, date, uuid[], int, text, boolean, text, int, int);
drop function public.kpi_order_set(date, date, uuid[]);

create or replace function public.kpi_by_wilaya(
  p_from date default null, p_to date default null, p_product uuid[] default null,
  p_filters jsonb default null
) returns table (
  wilaya_code smallint, wilaya_name text, rates jsonb, extras jsonb
)
language sql stable security invoker set search_path = public as $$
  with g as (
    select o.wilaya_code, array_agg(o.id) as ids
      from public.orders o
     where public.is_admin()
       and o.id in (select k.id from public.kpi_order_set(p_from, p_to, p_product, p_filters) k)
     group by o.wilaya_code
  )
  select g.wilaya_code, wl.name, public.kpi_rates(g.ids), public.kpi_group_extras(g.ids)
    from g
    left join public.wilayas wl on wl.code = g.wilaya_code;
$$;

create or replace function public.kpi_by_commune(
  p_wilaya int, p_from date default null, p_to date default null, p_product uuid[] default null,
  p_filters jsonb default null
) returns table (
  commune_key text, commune text, rates jsonb, extras jsonb
)
language sql stable security invoker set search_path = public as $$
  with s as (
    select o.id, nullif(lower(trim(o.commune)), '') as k, nullif(trim(o.commune), '') as c
      from public.orders o
     where public.is_admin()
       and o.wilaya_code = p_wilaya
       and o.id in (select x.id from public.kpi_order_set(p_from, p_to, p_product, p_filters) x)
  ), g as (
    select k, array_agg(id) as ids,
           (mode() within group (order by c)) as shown
      from s group by k
  )
  select g.k, g.shown, public.kpi_rates(g.ids), public.kpi_group_extras(g.ids) from g;
$$;

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
             else false end
  )
  select m.id, (select count(*) from m)
    from m order by m.created_at desc, m.id
   offset greatest(p_offset, 0) limit least(greatest(p_limit, 0), 100);
$$;

-- rates of one filtered set, computed in SQL (no id round trip, no max_rows cap)
create or replace function public.kpi_set_rates(
  p_from date default null, p_to date default null, p_product uuid[] default null,
  p_filters jsonb default null
) returns jsonb
language sql stable security invoker set search_path = public as $$
  select case when public.is_admin()
    then public.kpi_rates(array(select k.id from public.kpi_order_set(p_from, p_to, p_product, p_filters) k), p_from, p_to)
  end;
$$;

revoke execute on function public.kpi_order_set(date, date, uuid[], jsonb) from public, anon;
revoke execute on function public.kpi_by_wilaya(date, date, uuid[], jsonb) from public, anon;
revoke execute on function public.kpi_by_commune(int, date, date, uuid[], jsonb) from public, anon;
revoke execute on function public.kpi_drill_orders(text, date, date, uuid[], int, text, boolean, text, int, int, jsonb) from public, anon;
revoke execute on function public.kpi_set_rates(date, date, uuid[], jsonb) from public, anon;
grant execute on function public.kpi_order_set(date, date, uuid[], jsonb) to authenticated;
grant execute on function public.kpi_by_wilaya(date, date, uuid[], jsonb) to authenticated;
grant execute on function public.kpi_by_commune(int, date, date, uuid[], jsonb) to authenticated;
grant execute on function public.kpi_drill_orders(text, date, date, uuid[], int, text, boolean, text, int, int, jsonb) to authenticated;
grant execute on function public.kpi_set_rates(date, date, uuid[], jsonb) to authenticated;
