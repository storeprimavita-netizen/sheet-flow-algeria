-- 15j (OWASP 2nd pass, LOW CWE-367): transition_order_status now returns
-- whether the requested status actually changed. The row is locked FOR UPDATE
-- before the old value is read, so two concurrent "confirm" calls serialise:
-- only the first sees a change → the app auto-pushes to ZR once, not twice.
-- Body otherwise identical to 00015 (free transitions, role-scoped stages).

drop function public.transition_order_status(uuid, confirmation_status, delivery_status, text);

create function public.transition_order_status(
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
  v_role text := public.current_app_role();
begin
  select workspace_id, confirmation_status, delivery_status
    into v_ws, v_conf, v_deliv
    from public.orders where id = p_order_id
    for update;
  if v_ws is null or v_ws <> public.current_workspace_id() then
    raise exception 'order not found';
  end if;

  if not (
    public.is_admin()
    or (v_role = 'confirmation_agent' and p_delivery_status is null)
    or (v_role = 'delivery_agent' and p_confirmation_status is null)
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

  return (p_confirmation_status is not null and p_confirmation_status is distinct from v_conf)
      or (p_delivery_status is not null and p_delivery_status is distinct from v_deliv);
end; $$;

revoke execute on function public.transition_order_status(uuid, confirmation_status, delivery_status, text) from public, anon;
grant execute on function public.transition_order_status(uuid, confirmation_status, delivery_status, text) to authenticated;
