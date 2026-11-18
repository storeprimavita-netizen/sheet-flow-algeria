-- P0-8-F (D43): a replacement cancelled at confirmation holds nothing; swap status only by swap_order;
-- search_path pinned on every security definer function; stock log created_by not spoofable; view read-only.
-- No table or column change.

-- ---------------------------------------------------------------------------
-- 1) the rule gains the confirmation status: a replacement cancelled at confirmation -> 0 (the 4-arg version is dropped)
-- ---------------------------------------------------------------------------
drop view if exists public.product_stock_stages;
drop function if exists public.order_stock_target(public.delivery_status, integer, boolean, boolean);

create function public.order_stock_target(
  p_status public.delivery_status, p_qty integer, p_linked_original boolean, p_replacement boolean,
  p_confirmation public.confirmation_status)
returns integer
language sql immutable set search_path = public, pg_temp as $$
  select case
    when p_confirmation = 'cancelled' and p_replacement then 0
    when p_linked_original then 0
    when p_status in ('bureau_deposited','in_transit','out_for_delivery','stop_desk_waiting','delayed',
                      'returning','exchange','delivered') then -p_qty
    when p_status = 'wait_for_deposit' and p_replacement then -p_qty
    else 0
  end
$$;

drop function if exists public.stock_reconcile_order(uuid, uuid, public.stock_reason, public.delivery_status);
create function public.stock_reconcile_order(
  p_order_id uuid, p_product uuid, p_reason public.stock_reason, p_old_status public.delivery_status,
  p_old_confirmation public.confirmation_status default null)
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
                         else public.order_stock_target(p_old_status, o.quantity, v_linked, v_repl, coalesce(p_old_confirmation, o.confirmation_status)) end;
    v_reason := case
      when v_old_target is not distinct from v_current and v_target < v_current then 'order_shipped'
      when v_old_target is not distinct from v_current and v_target > v_current then 'order_returned'
      else 'order_stock_sync' end;
  end if;
  insert into public.stock_movements(workspace_id, product_id, delta, reason, order_id, created_by)
  values (o.workspace_id, v_product, v_target - v_current, v_reason, o.id, auth.uid());
end; $$;
revoke all on function public.stock_reconcile_order(uuid, uuid, public.stock_reason, public.delivery_status, public.confirmation_status)
  from public, anon, authenticated, service_role;

create or replace function public.order_stock_effects()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_reason public.stock_reason;
  v_old_status public.delivery_status;
  v_old_conf public.confirmation_status;
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
      v_old_conf := old.confirmation_status;
    end if;
  else
    v_reason := 'order_shipped';
  end if;

  perform public.stock_reconcile_order(new.id, null, v_reason, v_old_status, v_old_conf);

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

-- ---------------------------------------------------------------------------
-- 3) 'swap' status only through swap_order (D43); body of 00025 + the guard + pinned search_path
-- ---------------------------------------------------------------------------
create or replace function public.transition_order_status(
  p_order_id uuid,
  p_confirmation_status confirmation_status default null,
  p_delivery_status delivery_status default null,
  p_confirmation_comment text default null
)
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_ws uuid;
  v_conf confirmation_status;
  v_deliv delivery_status;
  v_assigned uuid;
  v_role text := public.current_app_role();
begin
  select workspace_id, confirmation_status, delivery_status, assigned_confirmation_agent
    into v_ws, v_conf, v_deliv, v_assigned
    from public.orders where id = p_order_id
    for update;
  if v_ws is null or v_ws <> public.current_workspace_id() then
    raise exception 'order not found';
  end if;

  -- D43: 'swap' is set only by swap_order (it sets this flag locally)
  if p_delivery_status = 'swap' and coalesce(current_setting('mnw.swap_status', true), '') <> '1' then
    raise exception 'swap is set only by swap_order';
  end if;

  if not public.is_admin() then
    if v_role is distinct from 'confirmation_agent' or p_delivery_status is not null then
      raise exception 'not authorized to update this order';
    end if;
    if not (v_conf in ('wait_for_confirmation','no_answer','closed_phone') or coalesce(v_assigned = auth.uid(), false)) then
      raise exception 'order is not in your confirmation queue';
    end if;
    -- recovery (e.g. confirmed → cancelled) is fine only before the parcel exists
    if v_deliv <> 'wait_for_deposit' or exists (select 1 from public.zr_shipments z where z.order_id = p_order_id) then
      raise exception 'order already handed to delivery';
    end if;
    perform set_config('mnw.assign_self', '1', true);
  end if;

  update public.orders set
    confirmation_status = coalesce(p_confirmation_status, confirmation_status),
    delivery_status = coalesce(p_delivery_status, delivery_status),
    confirmation_comment = case
      when p_confirmation_status is not null then p_confirmation_comment
      else confirmation_comment
    end,
    assigned_confirmation_agent = case
      when not public.is_admin() and assigned_confirmation_agent is null then auth.uid()
      else assigned_confirmation_agent
    end
  where id = p_order_id;

  return (p_confirmation_status is not null and p_confirmation_status is distinct from v_conf)
      or (p_delivery_status is not null and p_delivery_status is distinct from v_deliv);
end; $$;

create or replace function public.swap_order(
  p_order_id uuid,
  p_customer_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_wilaya_code smallint,
  p_commune text,
  p_address text
)
returns uuid
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  a public.orders%rowtype;
  v_b uuid;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  select * into a from public.orders
    where id = p_order_id and workspace_id = public.current_workspace_id() for update;
  if not found then raise exception 'order not found'; end if;
  if a.swapped_to_order_id is not null then return a.swapped_to_order_id; end if;  -- double submit
  if a.product_id is null then raise exception 'order has no product'; end if;
  if a.delivery_status not in ('returning', 'returned', 'exchange', 'delivered') then
    raise exception 'swap not allowed from status %', a.delivery_status;
  end if;
  if p_customer_id is not null
     and not exists (select 1 from public.customers where id = p_customer_id and workspace_id = a.workspace_id) then
    raise exception 'customer must belong to the order''s workspace';
  end if;

  insert into public.orders(workspace_id, source, product_id, variant, quantity, sale_price, delivery_fee,
      delivery_type, customer_id, customer_name, customer_phone, wilaya_code, commune, address,
      confirmation_status, delivery_status, placed_at)
  values (a.workspace_id, 'manual', a.product_id, a.variant, a.quantity, a.sale_price, a.delivery_fee,
      a.delivery_type, p_customer_id, p_customer_name, p_customer_phone, p_wilaya_code, nullif(p_commune, ''), nullif(p_address, ''),
      'confirmed', 'wait_for_deposit', now())
  returning id into v_b;

  -- link first (reconciles A -> 0 and B as a replacement on road), then A goes to 'swap' (D42)
  perform set_config('mnw.swap_link', '1', true);
  update public.orders set swapped_to_order_id = v_b where id = p_order_id;
  perform set_config('mnw.swap_link', '', true);
  perform set_config('mnw.swap_status', '1', true);
  perform public.transition_order_status(p_order_id, null, 'swap');
  perform set_config('mnw.swap_status', '', true);
  return v_b;
end; $$;


-- DB-level guard (review-1): 'swap' is written only inside swap_order, by anyone (admin PATCH, insert,
-- carrier map). No exemption for the service role.
create or replace function public.orders_swap_status_guard()
returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if new.delivery_status = 'swap'
     and (tg_op = 'INSERT' or old.delivery_status is distinct from 'swap')
     and coalesce(current_setting('mnw.swap_status', true), '') <> '1' then
    raise exception 'swap is set only by swap_order';
  end if;
  return new;
end; $$;

drop trigger if exists orders_swap_status_guard on public.orders;
create trigger orders_swap_status_guard
  before insert or update of delivery_status on public.orders
  for each row execute function public.orders_swap_status_guard();

-- the carrier sync skips a map entry to 'swap' instead of failing the whole sync
create or replace function public.apply_zr_state(
  p_ws uuid, p_parcel uuid, p_state text, p_slug text,
  p_situation text, p_is_return boolean, p_occurred timestamptz,
  p_live boolean default false
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_ship   public.zr_shipments;
  v_map    jsonb;
  v_mapped text;
begin
  if p_occurred is null then raise exception 'apply_zr_state: p_occurred is required'; end if;

  select * into v_ship from public.zr_shipments
   where workspace_id = p_ws and parcel_id = p_parcel
   for update;
  if not found then return null; end if;

  if p_state is not null then
    -- strictly newer always applies. A same-timestamp DIFFERENT state applies only for
    -- live reads (p_live: Refresh/cron read ZR's current state, so a tie means ZR changed
    -- state within one second). Webhooks (p_live false) ignore ties: delivery order is not
    -- guaranteed, so a tie could be a late older event. A same-state replay is a no-op so
    -- it cannot re-sync the order over an admin correction; the comparison is
    -- case/whitespace-insensitive. The order update lives in this branch too.
    if v_ship.occurred_at is null or v_ship.occurred_at < p_occurred
       or (p_live and v_ship.occurred_at = p_occurred
           and lower(btrim(v_ship.state)) is distinct from lower(btrim(p_state))) then
      update public.zr_shipments
         set state = p_state, state_slug = p_slug,
             occurred_at = p_occurred, state_updated_at = p_occurred
       where order_id = v_ship.order_id
       returning * into v_ship;

      select value -> 'map' into v_map from public.settings
       where workspace_id = p_ws and key = 'zr_state_map';
      if not found then   -- never configured: built-in defaults
        v_map := '{"livre":"delivered","encaisse":"delivered","recouvert":"delivered","recupere_par_fournisseur":"returned"}';
      end if;
      v_mapped := v_map ->> lower(btrim(v_ship.state));
      -- D43: a map entry to 'swap' is never applied (swap is set only by swap_order)
      if v_mapped is not null and v_mapped <> 'swap' then
        update public.orders set delivery_status = v_mapped::delivery_status
         where id = v_ship.order_id and workspace_id = p_ws
           and delivery_status is distinct from v_mapped::delivery_status;
      end if;
    end if;
  elsif v_ship.situation_at is null or v_ship.situation_at <= p_occurred then
    update public.zr_shipments
       set situation = coalesce(p_situation, situation),
           is_return = coalesce(p_is_return, is_return),
           situation_at = p_occurred
     where order_id = v_ship.order_id;
  end if;

  return v_ship.order_id;
end; $$;

-- ---------------------------------------------------------------------------
-- 4) every public security definer function pins search_path with pg_temp last
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%pg_temp%')
  loop
    execute format('alter function %s set search_path = public, pg_temp', r.sig);
  end loop;
end; $$;

-- ---------------------------------------------------------------------------
-- 5) stock log: created_by cannot be spoofed on insert
-- ---------------------------------------------------------------------------
drop policy if exists stock_movements_ins on public.stock_movements;
create policy stock_movements_ins on public.stock_movements for insert to authenticated
  with check (workspace_id = (select public.current_workspace_id()) and (select public.is_admin())
              and reason in ('purchase', 'correction') and order_id is null
              and (created_by is null or created_by = (select auth.uid())));

-- ---------------------------------------------------------------------------
-- 6) the stage view is read-only for every API role
-- ---------------------------------------------------------------------------
revoke insert, update, delete, truncate on public.product_stock_stages from anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7) one-time pass: replacements already cancelled at confirmation release their piece (adds log lines only)
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in select o.id from public.orders o
           where o.confirmation_status = 'cancelled' and o.product_id is not null
             and exists (select 1 from public.orders x where x.swapped_to_order_id = o.id and x.workspace_id = o.workspace_id)
  loop
    perform public.stock_reconcile_order(r.id, null, 'order_stock_sync', null);
  end loop;
end; $$;
