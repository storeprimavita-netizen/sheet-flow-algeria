drop index public.orders_workspace_normalized_phone_idx;

create index orders_workspace_normalized_phone_idx
  on public.orders (workspace_id, public.normalize_dz_phone(customer_phone), placed_at desc nulls last, id desc);

create or replace function public.confirmation_customer_score(p_order_id uuid)
returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare
  v_workspace uuid := public.current_workspace_id();
  v_role text := public.current_app_role();
  v_customer uuid;
  v_has_saved_link boolean;
  v_product uuid;
  v_phone text;
  v_summary jsonb;
  v_related jsonb := '[]';
  v_has_more boolean := false;
begin
  if v_workspace is null or coalesce(v_role, '') not in ('admin', 'confirmation_agent') then
    return null;
  end if;

  select o.customer_id, o.product_id, public.normalize_dz_phone(o.customer_phone)
    into v_customer, v_product, v_phone
  from public.orders o
  where o.workspace_id = v_workspace and o.id = p_order_id;
  if not found then
    return null;
  end if;

  v_has_saved_link := v_customer is not null;
  if v_has_saved_link then
    select c.id into v_customer
    from public.customers c
    where c.workspace_id = v_workspace and c.id = v_customer;
  elsif v_phone ~ '^0[567][0-9]{8}$' then
    select c.id into v_customer
    from public.customers c
    where c.workspace_id = v_workspace and c.phone = v_phone;
  end if;

  if v_customer is not null then
    select jsonb_build_object(
      'id', s.id, 'total', s.total_orders, 'delivered', s.delivered_orders,
      'returned', s.returned_orders, 'cancelled', s.cancelled_orders, 'noAnswer', s.no_answer_orders,
      'score', s.risk_score, 'state', s.risk_state, 'reason', s.risk_reason,
      'lastAt', s.last_order_at, 'confirmation', s.last_confirmation_status,
      'delivery', s.last_delivery_status, 'productOrders', p.order_count,
      'deliveryRate', case when d.delivery_matured then d.delivery_value end
    ) || case when v_role = 'admin'
      then jsonb_build_object('lifetime', d.lifetime_delivered_value_dzd)
      else '{}'::jsonb end
    into v_summary
    from public.customer_stats s
    left join public.customer_product_stats p on p.workspace_id = s.workspace_id
      and p.customer_id = s.id and p.product_id = v_product
    left join public.customer_delivery_stats d on d.workspace_id = s.workspace_id and d.customer_id = s.id
    where s.workspace_id = v_workspace and s.id = v_customer;
  end if;

  if v_phone ~ '^0[567][0-9]{8}$' then
    -- Mirrors ACTIONABLE_CONFIRMATION and ACTIONABLE_DELIVERY in statuses.ts.
    with recent as (
      select o.id, o.order_seq, o.placed_at, o.confirmation_status, o.delivery_status
      from public.orders o
      where o.workspace_id = v_workspace and o.id <> p_order_id
        and public.normalize_dz_phone(o.customer_phone) = v_phone
        and (o.confirmation_status in ('wait_for_confirmation', 'no_answer', 'closed_phone')
          or (o.confirmation_status = 'confirmed' and o.delivery_status in (
            'wait_for_deposit', 'bureau_deposited', 'in_transit', 'out_for_delivery',
            'stop_desk_waiting', 'delayed', 'returning', 'exchange'
          )))
      order by o.placed_at desc nulls last, o.id desc
      limit 6
    ), numbered as (
      select recent.*, row_number() over (order by placed_at desc nulls last, id desc) as position
      from recent
    )
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'seq', order_seq, 'at', placed_at,
        'confirmation', confirmation_status, 'delivery', delivery_status
      ) order by position) filter (where position <= 5), '[]'), count(*) > 5
      into v_related, v_has_more
    from numbered;
  end if;

  return jsonb_build_object(
    'scope', case when v_role = 'admin' then 'workspace' else 'visible' end,
    'link', case
      when v_summary is not null then 'resolved'
      when v_has_saved_link then 'unresolved'
      else 'unlinked'
    end,
    'customer', v_summary, 'related', v_related, 'hasMore', v_has_more
  );
end;
$$;
