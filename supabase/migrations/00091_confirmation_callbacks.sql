-- CONF-4: callbacks belong to the actionable, pre-deposit confirmation queue.
alter table public.orders add column callback_at timestamptz,
  add constraint orders_callback_eligible check (
    callback_at is null or (
      confirmation_status in ('wait_for_confirmation', 'no_answer', 'closed_phone')
      and delivery_status = 'wait_for_deposit'
    )
  );

create index orders_callback_due_idx on public.orders(workspace_id, callback_at, id)
  where callback_at is not null;

create or replace function public.guard_order_fields()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r text := public.current_app_role();
  allowed text[] := array['updated_at','confirmation_status','confirmation_comment',
                          'confirmation_attempts','cancellation_reason_option_id'];
begin
  if auth.uid() is null then return new; end if;   -- service role (webhooks / ZR sync)
  if r is null then raise exception 'no active role for current user'; end if;
  if r = 'admin' then return new; end if;
  if r <> 'confirmation_agent' then raise exception 'role % cannot modify orders', r; end if;
  -- once handed to delivery (shipped state or a ZR parcel) the order is out of
  -- the confirmation agent's hands on EVERY path (direct PATCH or RPC)
  if old.delivery_status <> 'wait_for_deposit'
     or exists (select 1 from public.zr_shipments z where z.order_id = old.id) then
    raise exception 'order already handed to delivery';
  end if;
  -- only transition_order_status (sets this flag locally) may auto-assign
  if coalesce(current_setting('mnw.assign_self', true), '') = '1' then
    allowed := allowed || array['assigned_confirmation_agent'];
  end if;
  if current_setting('mnw.callback_order', true) = old.id::text then
    allowed := allowed || 'callback_at'::text;
  end if;
  if (to_jsonb(new) - allowed) is distinct from (to_jsonb(old) - allowed) then
    raise exception 'confirmation agents may only change confirmation fields';
  end if;
  return new;
end; $$;

create function public.validate_order_callback()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.callback_at is not null then
      raise exception 'callback requires the callback action' using errcode = '42501';
    end if;
  elsif new.callback_at is distinct from old.callback_at
    and current_setting('mnw.callback_order', true) is distinct from old.id::text then
    raise exception 'callback requires the callback action' using errcode = '42501';
  end if;

  -- This trigger runs after orders_guard_fields has checked the submitted changes.
  if new.confirmation_status not in ('wait_for_confirmation', 'no_answer', 'closed_phone')
    or new.delivery_status <> 'wait_for_deposit' then
    new.callback_at := null;
  end if;
  return new;
end; $$;

create trigger orders_validate_callback before insert or update on public.orders
  for each row execute function public.validate_order_callback();
revoke execute on function public.validate_order_callback() from public, anon, authenticated;

create function public.set_order_callback(p_order_id uuid, p_callback_at timestamptz)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  ws uuid := public.current_workspace_id();
  role_name text := public.current_app_role();
  target public.orders;
  prior_context text;
begin
  if ws is null or role_name is null or role_name not in ('admin', 'confirmation_agent') then
    raise exception 'callback not allowed' using errcode = '42501';
  end if;

  select * into target from public.orders
    where workspace_id = ws and id = p_order_id for update;
  if not found then
    raise exception 'callback not allowed' using errcode = '42501';
  end if;
  if target.confirmation_status not in ('wait_for_confirmation', 'no_answer', 'closed_phone')
     or target.delivery_status <> 'wait_for_deposit'
     or exists (
       select 1 from public.zr_shipments
       where workspace_id = ws and order_id = p_order_id
     ) then
    raise exception 'order no longer accepts callbacks' using errcode = '55000';
  end if;
  if p_callback_at is not null and (not isfinite(p_callback_at) or p_callback_at <= clock_timestamp()) then
    raise exception 'callback must be in the future' using errcode = '22023';
  end if;
  if p_callback_at is not distinct from target.callback_at then
    return;
  end if;

  prior_context := current_setting('mnw.callback_order', true);
  perform set_config('mnw.callback_order', p_order_id::text, true);
  update public.orders set callback_at = p_callback_at where workspace_id = ws and id = p_order_id;
  perform set_config('mnw.callback_order', coalesce(prior_context, ''), true);
end; $$;
revoke execute on function public.set_order_callback(uuid, timestamptz) from public, anon, service_role;
grant execute on function public.set_order_callback(uuid, timestamptz) to authenticated;

create function public.seed_confirmation_callback_views(ws uuid)
returns void language plpgsql set search_path = '' as $$
declare
  item record;
begin
  perform pg_advisory_xact_lock(hashtextextended(ws::text || 'confirmationshared', 0));
  for item in
    select * from (values
      (1, 'callbacks_due', 'Callbacks due'), (2, 'confirmed_today', 'Today confirmed')
    ) as seeds(rank, seed_key, name) order by rank
  loop
    if not exists (
      select 1 from public.order_views where workspace_id = ws
        and (seed_key = item.seed_key or (scope = 'confirmation' and owner_id is null and lower(name) = lower(item.name)))
    ) then
      insert into public.order_views(workspace_id, seed_key, name, scope, config, position)
      select ws, item.seed_key, item.name, 'confirmation', jsonb_build_object('queue_slice', item.seed_key),
        least(coalesce(max(position)::bigint + 1, 0), 2147483647)::int
      from public.order_views where workspace_id = ws and scope = 'confirmation' and owner_id is null
      having count(*) < 20
      on conflict do nothing;
    end if;
  end loop;
end; $$;
revoke execute on function public.seed_confirmation_callback_views(uuid) from public, anon, authenticated;
grant execute on function public.seed_confirmation_callback_views(uuid) to service_role;

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
  perform public.seed_confirmation_callback_views(ws);
end; $$;
revoke execute on function public.seed_order_views(uuid) from public, anon, authenticated;
revoke execute on function public.order_views_seed_for_workspace() from public, anon, authenticated;


select public.seed_confirmation_callback_views(id) from public.workspaces;
