-- ============================================================================
-- Fix: agents can never transition an order into their own row-security
-- "blind spot" via a plain UPDATE.
--
-- Found in Phase 10's E2E pass: PostgreSQL requires the POST-update row to
-- still satisfy the table's SELECT policy (o_sel) for the calling role, in
-- addition to the UPDATE policy's WITH CHECK (o_upd) — proven empirically by
-- relaxing each policy in isolation. o_sel hides confirmed orders from
-- confirmation_agent, so `update orders set confirmation_status='confirmed'`
-- moves the row out of their own visible set and Postgres rejects the whole
-- statement with "new row violates row-level security policy", even though
-- o_upd's WITH CHECK is satisfied. This broke the confirmation queue's
-- "confirm" action (and the order detail page's confirm button) for every
-- confirmation_agent since Phase 5 — never caught because no live agent
-- session existed until this phase's seeded users.
--
-- Fix: route status transitions through a SECURITY DEFINER function that
-- re-implements o_upd's USING check explicitly (since it bypasses RLS
-- entirely) and then updates directly — same pattern as
-- current_workspace_id()/is_admin()/bootstrap_workspace. guard_order_fields
-- (also SECURITY DEFINER, keyed off auth.uid() which is unaffected by this
-- function's elevated privileges) still enforces per-role field
-- restrictions on the write itself.
-- ============================================================================
create or replace function public.transition_order_status(
  p_order_id uuid,
  p_confirmation_status confirmation_status default null,
  p_delivery_status delivery_status default null,
  p_confirmation_comment text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_ws uuid;
  v_conf confirmation_status;
  v_role text := public.current_app_role();
begin
  select workspace_id, confirmation_status into v_ws, v_conf
    from public.orders where id = p_order_id;
  if v_ws is null or v_ws <> public.current_workspace_id() then
    raise exception 'order not found';
  end if;

  if not (
    public.is_admin()
    or (v_role = 'confirmation_agent' and v_conf <> 'confirmed')
    or (v_role = 'delivery_agent' and v_conf = 'confirmed')
  ) then
    raise exception 'not authorized to update this order';
  end if;

  update public.orders set
    confirmation_status = coalesce(p_confirmation_status, confirmation_status),
    delivery_status = coalesce(p_delivery_status, delivery_status),
    confirmation_comment = case
      when p_confirmation_status is not null then p_confirmation_comment
      else confirmation_comment
    end
  where id = p_order_id;
end; $$;

grant execute on function public.transition_order_status(uuid, confirmation_status, delivery_status, text) to authenticated;
