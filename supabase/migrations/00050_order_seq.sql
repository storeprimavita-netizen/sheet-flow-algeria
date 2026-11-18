-- ORD-1 (D57): per-workspace running order number `orders.order_seq` (#0001).
-- `orders.order_number` stays the EXTERNAL platform reference.

-- 1. Counter table: not reachable by any client role (RLS on, no policy, no grant).
create table public.order_counters (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  next_seq int not null default 1 check (next_seq > 0)
);
alter table public.order_counters enable row level security;
revoke all on public.order_counters from anon, authenticated;
revoke insert, update, delete, truncate on public.order_counters from service_role;

create or replace function public.order_counters_for_workspace()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.order_counters (workspace_id) values (new.id) on conflict do nothing;
  return new;
end; $$;
revoke execute on function public.order_counters_for_workspace() from public, anon, authenticated;

create trigger workspaces_order_counter after insert on public.workspaces
  for each row execute function public.order_counters_for_workspace();

-- 2. Column + backfill (updated_at untouched).
alter table public.orders add column order_seq int not null default 0;

alter table public.orders disable trigger set_updated_at;
create temp table _ord_before on commit drop as select id, updated_at from public.orders;
with numbered as (
  select id, row_number() over (
    partition by workspace_id order by coalesce(placed_at, created_at), created_at, id) as rn
  from public.orders)
update public.orders o set order_seq = n.rn from numbered n where n.id = o.id;
alter table public.orders enable trigger set_updated_at;

do $$
begin
  if exists (select 1 from public.orders o join _ord_before b using (id) where o.updated_at is distinct from b.updated_at) then
    raise exception 'order_seq backfill changed updated_at';
  end if;
  if exists (select 1 from public.orders where order_seq <= 0) then
    raise exception 'order_seq backfill left unnumbered orders';
  end if;
  if exists (select 1 from (select workspace_id, count(*) c, max(order_seq) m, min(order_seq) mn
                            from public.orders group by 1) s where s.c <> s.m or s.mn <> 1) then
    raise exception 'order_seq backfill has gaps';
  end if;
  if exists (
    select 1 from (
      select (coalesce(placed_at, created_at), created_at, id) as k,
             lag((coalesce(placed_at, created_at), created_at, id))
               over (partition by workspace_id order by order_seq) as pk
      from public.orders) x
    where x.pk is not null and x.pk > x.k) then
    raise exception 'order_seq backfill order is wrong';
  end if;
end; $$;

insert into public.order_counters (workspace_id, next_seq)
select w.id, coalesce(max(o.order_seq), 0) + 1
from public.workspaces w left join public.orders o on o.workspace_id = w.id
group by w.id
on conflict (workspace_id) do update set next_seq = excluded.next_seq;

alter table public.orders
  add constraint orders_order_seq_pos check (order_seq > 0),
  add constraint orders_workspace_order_seq_key unique (workspace_id, order_seq);

-- 3. Assign on insert (ignores any supplied value).
create or replace function public.orders_assign_seq()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.order_counters set next_seq = next_seq + 1
   where workspace_id = new.workspace_id returning next_seq - 1 into new.order_seq;
  if new.order_seq is null and exists (select 1 from public.workspaces where id = new.workspace_id) then
    -- counter row missing: re-seed from the existing orders, never restart at 1
    insert into public.order_counters (workspace_id, next_seq)
    select new.workspace_id, coalesce(max(order_seq), 0) + 2 from public.orders where workspace_id = new.workspace_id
    on conflict (workspace_id) do update set next_seq = public.order_counters.next_seq + 1
    returning next_seq - 1 into new.order_seq;
  end if;
  if new.order_seq is null then
    raise exception 'unknown workspace' using errcode = '23503';
  end if;
  return new;
end; $$;
revoke execute on function public.orders_assign_seq() from public, anon, authenticated;

create trigger orders_assign_seq before insert on public.orders
  for each row execute function public.orders_assign_seq();

-- 4. Immutable.
create or replace function public.orders_seq_immutable()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.order_seq is distinct from old.order_seq or new.workspace_id is distinct from old.workspace_id then
    raise exception 'orders.order_seq and workspace_id are immutable' using errcode = '42501';
  end if;
  return new;
end; $$;
create trigger orders_seq_immutable before update on public.orders
  for each row execute function public.orders_seq_immutable();
