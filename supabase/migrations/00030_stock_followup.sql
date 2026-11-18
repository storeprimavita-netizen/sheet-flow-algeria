-- P0-8-F (D43): a replacement cancelled at confirmation holds nothing; swap status only by swap_order;
-- search_path pinned on every security definer function; stock log created_by not spoofable; view read-only.
-- No table or column change.

-- ---------------------------------------------------------------------------
-- 1) the rule gains the confirmation status: cancelled at confirmation -> 0 (the 4-arg version is dropped)
-- ---------------------------------------------------------------------------
drop view if exists public.product_stock_stages;
drop function if exists public.order_stock_target(public.delivery_status, integer, boolean, boolean);

create function public.order_stock_target(
  p_status public.delivery_status, p_qty integer, p_linked_original boolean, p_replacement boolean,
  p_confirmation public.confirmation_status)
returns integer
language sql immutable set search_path = public, pg_temp as $$
  select case
    when p_confirmation = 'cancelled' then 0
    when p_linked_original then 0
    when p_status in ('bureau_deposited','in_transit','out_for_delivery','stop_desk_waiting','delayed',
                      'returning','exchange','delivered') then -p_qty
    when p_status = 'wait_for_deposit' and p_replacement then -p_qty
    else 0
  end
$$;

create or replace function public.stock_reconcile_order(
  p_order_id uuid, p_product uuid, p_reason public.stock_reason, p_old_status public.delivery_status)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  o public.orders%rowtype;
  v_product uuid;
  v_linked boolean;
  v_repl boolean;
  v_target integer;
  v_old_target integer;
  v_current integer;
  v_reason public.stock_reason;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then return; end if;
  v_product := coalesce(p_product, o.product_id);
  if v_product is null then return; end if;

  v_linked := o.swapped_to_order_id is not null;
  v_repl := exists (select 1 from public.orders r where r.swapped_to_order_id = o.id and r.workspace_id = o.workspace_id);
  v_target := case when v_product = o.product_id
                   then public.order_stock_target(o.delivery_status, o.quantity, v_linked, v_repl, o.confirmation_status) else 0 end;
  select coalesce(sum(delta), 0) into v_current from public.stock_movements
    where order_id = o.id and product_id = v_product and reason = any(public.stock_order_reasons());
  if v_target = v_current then return; end if;

  v_reason := p_reason;
  if v_reason is null then
    v_old_target := case when p_old_status is null then null
                         else public.order_stock_target(p_old_status, o.quantity, v_linked, v_repl, o.confirmation_status) end;
    v_reason := case
      when v_old_target is not distinct from v_current and v_target < v_current then 'order_shipped'
      when v_old_target is not distinct from v_current and v_target > v_current then 'order_returned'
      else 'order_stock_sync' end;
  end if;
  insert into public.stock_movements(workspace_id, product_id, delta, reason, order_id, created_by)
  values (o.workspace_id, v_product, v_target - v_current, v_reason, o.id, auth.uid());
end; $$;
revoke all on function public.stock_reconcile_order(uuid, uuid, public.stock_reason, public.delivery_status)
  from public, anon, authenticated, service_role;

create or replace function public.order_stock_effects()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_reason public.stock_reason;
  v_old_status public.delivery_status;
  v_other uuid;
begin
  if tg_op = 'UPDATE' then
    if old.delivery_status is not distinct from new.delivery_status
       and old.confirmation_status is not distinct from new.confirmation_status
       and old.quantity is not distinct from new.quantity
       and old.product_id is not distinct from new.product_id
       and old.swapped_to_order_id is not distinct from new.swapped_to_order_id then
      return new;
    end if;
  end if;

  if new.product_id is not null
     and not exists (select 1 from public.products where id = new.product_id and workspace_id = new.workspace_id) then
    raise exception 'order product must belong to the order''s workspace';
  end if;

  -- D30: a swap link must stay inside the workspace
  if new.swapped_to_order_id is not null
     and exists (select 1 from public.orders x where x.id = new.swapped_to_order_id and x.workspace_id <> new.workspace_id) then
    raise exception 'swap link must point to an order of the same workspace';
  end if;

  if tg_op = 'UPDATE' then
    -- product changed: release the old product first
    if old.product_id is not null and old.product_id is distinct from new.product_id then
      perform public.stock_reconcile_order(new.id, old.product_id, 'order_stock_sync', null);
    end if;
    if old.product_id is distinct from new.product_id or old.quantity is distinct from new.quantity then
      v_reason := 'order_stock_sync';
    elsif old.swapped_to_order_id is distinct from new.swapped_to_order_id then
      v_reason := case when new.swapped_to_order_id is not null then 'order_swapped' else 'order_stock_sync' end;
    else
      v_old_status := old.delivery_status;
    end if;
  else
    v_reason := 'order_shipped';
  end if;

  perform public.stock_reconcile_order(new.id, null, v_reason, v_old_status);

  -- the replacement gains or loses "replacement" status when the link moves: reconcile it too
  if tg_op = 'UPDATE' and old.swapped_to_order_id is distinct from new.swapped_to_order_id then
    foreach v_other in array array[old.swapped_to_order_id, new.swapped_to_order_id] loop
      if v_other is not null then
        perform public.stock_reconcile_order(v_other, null,
          case when v_other = new.swapped_to_order_id then 'order_swapped' else 'order_stock_sync' end::public.stock_reason, null);
      end if;
    end loop;
  end if;
  return new;
end; $$;

drop trigger if exists orders_stock_effects on public.orders;
create trigger orders_stock_effects
  after insert or update of delivery_status, confirmation_status, quantity, product_id, swapped_to_order_id on public.orders
  for each row execute function public.order_stock_effects();

create or replace function public.order_stock_release()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r record;
begin
  if public.order_stock_target(old.delivery_status, old.quantity, false, false, old.confirmation_status) >= 0 then
    for r in select product_id, sum(delta)::integer as held from public.stock_movements
             where order_id = old.id and reason = any(public.stock_order_reasons())
             group by product_id having sum(delta) <> 0 loop
      if exists (select 1 from public.products where id = r.product_id)
         and exists (select 1 from public.workspaces where id = old.workspace_id) then
        insert into public.stock_movements(workspace_id, product_id, delta, reason, order_id, created_by)
        values (old.workspace_id, r.product_id, -r.held, 'order_stock_sync', old.id, auth.uid());
      end if;
    end loop;
  end if;
  return old;
end; $$;


create or replace view public.product_stock_stages with (security_invoker = true) as
select p.id as product_id,
       p.workspace_id,
       p.stock as in_stock,
       coalesce(sum(f.quantity) filter (where f.confirmation_status = 'confirmed' and f.delivery_status = 'wait_for_deposit'
                                          and not f.is_replacement and not f.is_linked), 0)::integer as reserved,
       coalesce(sum(f.quantity) filter (where f.target < 0 and f.delivery_status <> 'delivered'), 0)::integer as on_road,
       coalesce(sum(f.quantity) filter (where f.target < 0 and f.delivery_status = 'delivered'), 0)::integer as delivered
from public.products p
left join (
  select s.*, public.order_stock_target(s.delivery_status, s.quantity, s.is_linked, s.is_replacement, s.confirmation_status) as target
  from (
    select o.product_id, o.quantity, o.delivery_status, o.confirmation_status,
           o.swapped_to_order_id is not null as is_linked,
           exists (select 1 from public.orders r where r.swapped_to_order_id = o.id and r.workspace_id = o.workspace_id) as is_replacement
    from public.orders o
  ) s
) f on f.product_id = p.id
where public.is_admin()
group by p.id, p.workspace_id, p.stock;
revoke all on public.product_stock_stages from anon;
grant select on public.product_stock_stages to authenticated;
