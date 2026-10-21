-- ============================================================================
-- 25 — Agent permission matrix (DECISIONS D9/D10). Supersedes 00015's
-- "agents see everything / free transitions across any order".
--
--  admin               : everything (audited by order_status_history / audit_log).
--  confirmation_agent  : sees the OPEN confirmation queue + orders assigned to
--                        them; may change only confirmation fields
--                        (status via RPC, comment, attempts, cancellation
--                        reason); never customer name/phone/address/wilaya/
--                        delivery type/assignment/price/product/qty. Cannot
--                        touch delivery_status, nor orders already pushed to
--                        ZR / past wait_for_deposit.
--  delivery_agent      : LEGACY (no internal delivery staff — ZR owns delivery
--                        status). Read-only on confirmed orders; no writes.
--  service role (ZR/webhooks): unchanged (auth.uid() is null).
-- The enum value, assigned_delivery_agent column and old rows are kept.
-- ============================================================================

-- 1) visibility ---------------------------------------------------------------
drop policy if exists o_sel on public.orders;
create policy o_sel on public.orders for select to authenticated using (
  workspace_id = public.current_workspace_id() and (
    public.is_admin()
    or (public.current_app_role() = 'confirmation_agent' and (
          confirmation_status in ('wait_for_confirmation', 'no_answer', 'closed_phone')
          or assigned_confirmation_agent = auth.uid()))
    or (public.current_app_role() = 'delivery_agent' and confirmation_status = 'confirmed')
  )
);

-- 2) direct UPDATE: admin, or a confirmation agent on a row they can see -------
-- (the column allow-list lives in guard_order_fields below)
drop policy if exists o_upd on public.orders;
create policy o_upd on public.orders for update to authenticated
  using (
    workspace_id = public.current_workspace_id() and (
      public.is_admin()
      or (public.current_app_role() = 'confirmation_agent' and (
            confirmation_status in ('wait_for_confirmation', 'no_answer', 'closed_phone')
            or assigned_confirmation_agent = auth.uid()))
    ))
  with check (
    workspace_id = public.current_workspace_id() and (
      public.is_admin() or public.current_app_role() = 'confirmation_agent'
    ));

-- 3) column allow-list (default-deny: future order columns are admin-only) ----
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
  if (to_jsonb(new) - allowed) is distinct from (to_jsonb(old) - allowed) then
    raise exception 'confirmation agents may only change confirmation fields';
  end if;
  return new;
end; $$;

-- 4) status transitions --------------------------------------------------------
create or replace function public.transition_order_status(
  p_order_id uuid,
  p_confirmation_status confirmation_status default null,
  p_delivery_status delivery_status default null,
  p_confirmation_comment text default null
)
returns boolean
language plpgsql security definer set search_path = public as $$
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
