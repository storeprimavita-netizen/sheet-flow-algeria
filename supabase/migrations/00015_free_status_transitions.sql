-- ============================================================================
-- Phase 14a — Orders status model rework: free status changes within role.
--
-- Both agent roles now SEE all workspace orders (o_sel/o_upd drop the
-- confirmation_status-based hiding that assigned confirmation_agent the
-- pre-handoff pipeline and delivery_agent the post-handoff one). This also
-- removes 00009's RLS "blind spot" itself, since visibility no longer
-- depends on the row's own status value. Role now only gates WHICH field a
-- direct UPDATE may touch (guard_order_fields, unchanged) and which stage a
-- status transition may set (transition_order_status, rewritten below).
-- Money stays UI-gated (`showMoney`) and financial tables stay admin-only —
-- this exposes no new money, only logistics fields agents could already see
-- on their own half of the pipeline.
-- ============================================================================

drop policy if exists o_sel on public.orders;
create policy o_sel on public.orders for select to authenticated using (
  workspace_id = public.current_workspace_id()
);

drop policy if exists o_upd on public.orders;
create policy o_upd on public.orders for update to authenticated
  using (
    workspace_id = public.current_workspace_id() and (
      public.is_admin() or public.current_app_role() in ('confirmation_agent', 'delivery_agent')
    ))
  with check (
    workspace_id = public.current_workspace_id() and (
      public.is_admin() or public.current_app_role() in ('confirmation_agent', 'delivery_agent')
    ));

-- transition_order_status: role now gates by WHICH param is being set, not by
-- the row's current confirmation_status. confirmation_agent may set
-- confirmation_status to any value (as long as they're not also touching
-- delivery_status in the same call); delivery_agent likewise for
-- delivery_status; admin may set either/both.
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
  v_role text := public.current_app_role();
begin
  select workspace_id into v_ws from public.orders where id = p_order_id;
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
end; $$;

grant execute on function public.transition_order_status(uuid, confirmation_status, delivery_status, text) to authenticated;
