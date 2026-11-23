-- CONF-2: shared Confirmation Kanban and note-preserving status transitions.
create function public.seed_confirmation_kanban(ws uuid)
returns void language plpgsql set search_path = public, pg_temp as $$
begin
  -- Same group lock as the view cap trigger, taken before choosing a position.
  perform pg_advisory_xact_lock(hashtextextended(ws::text || 'confirmationshared', 0));
  if exists (
    select 1 from public.order_views
    where workspace_id = ws
      and (seed_key = 'kanban_by_status'
           or (scope = 'confirmation' and owner_id is null and lower(name) = 'kanban by status'))
  ) then
    return;
  end if;

  insert into public.order_views (workspace_id, seed_key, name, scope, layout, position)
  select ws, 'kanban_by_status', 'Kanban by status', 'confirmation', 'kanban',
         least(coalesce(max(position)::bigint + 1, 0), 2147483647)::int
    from public.order_views
   where workspace_id = ws and scope = 'confirmation' and owner_id is null
  having count(*) < 20
  on conflict do nothing;
end; $$;
revoke execute on function public.seed_confirmation_kanban(uuid) from public, anon, authenticated;
grant execute on function public.seed_confirmation_kanban(uuid) to service_role;

create or replace function public.seed_order_views(ws uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.order_views (workspace_id, owner_id, seed_key, name, scope, config, position)
  values
    (ws, null, 'new', 'New', 'confirmation', '{"confirmation_status":["wait_for_confirmation"]}', 0),
    (ws, null, 'no_answer', 'No answer', 'confirmation', '{"confirmation_status":["no_answer","closed_phone"]}', 1),
    (ws, null, 'duplicates', 'Duplicates', 'all', '{"duplicates":"1"}', 0)
  on conflict (workspace_id, seed_key) where seed_key is not null do nothing;

  perform public.seed_confirmation_kanban(ws);
end; $$;
revoke execute on function public.seed_order_views(uuid) from public, anon, authenticated;
revoke execute on function public.order_views_seed_for_workspace() from public, anon, authenticated;

-- Existing workspaces receive only the new seed, including those with deleted legacy seeds.
select public.seed_confirmation_kanban(id) from public.workspaces;

create function public.transition_order_status(
  p_order_id uuid,
  p_confirmation_status confirmation_status,
  p_delivery_status delivery_status,
  p_confirmation_comment text,
  p_preserve_confirmation_comment boolean
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
  if p_preserve_confirmation_comment is null
     or (p_preserve_confirmation_comment and p_confirmation_comment is not null) then
    raise exception 'invalid confirmation comment mode' using errcode = 'invalid_parameter_value';
  end if;

  select workspace_id, confirmation_status, delivery_status, assigned_confirmation_agent
    into v_ws, v_conf, v_deliv, v_assigned
    from public.orders where id = p_order_id
    for update;
  if v_ws is null or v_ws is distinct from public.current_workspace_id() then
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
      when p_confirmation_status is not null and not p_preserve_confirmation_comment then p_confirmation_comment
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

-- Keep all established callers on the existing signature and comment behavior.
create or replace function public.transition_order_status(
  p_order_id uuid,
  p_confirmation_status confirmation_status default null,
  p_delivery_status delivery_status default null,
  p_confirmation_comment text default null
)
returns boolean
language sql security definer set search_path = public, pg_temp as $$
  select public.transition_order_status(
    p_order_id, p_confirmation_status, p_delivery_status, p_confirmation_comment, false
  );
$$;
revoke execute on function public.transition_order_status(uuid, confirmation_status, delivery_status, text)
  from public, anon;
grant execute on function public.transition_order_status(uuid, confirmation_status, delivery_status, text)
  to authenticated;
revoke execute on function public.transition_order_status(uuid, confirmation_status, delivery_status, text, boolean)
  from public, anon;
grant execute on function public.transition_order_status(uuid, confirmation_status, delivery_status, text, boolean)
  to authenticated;
