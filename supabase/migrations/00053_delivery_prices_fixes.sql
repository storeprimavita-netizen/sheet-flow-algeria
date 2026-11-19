-- P1-7 review 1: swap recomputes the fee for the new wilaya; apply_delivery_prices rejects bad input.
create or replace function public.apply_delivery_prices(p jsonb)
returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  ws uuid := public.current_workspace_id();
  w jsonb;
  v_code smallint;
  v_home numeric;
  v_desk numeric;
  v_priced boolean;
  v_avail boolean;
  v_total_communes int := 0;
  v_changed int := 0;
  n int;
begin
  if not public.is_admin() or ws is null then raise exception 'admin only'; end if;
  if coalesce(jsonb_typeof(p->'wilayas'), '') <> 'array' then raise exception 'wilayas must be an array'; end if;
  if jsonb_array_length(p->'wilayas') > 58 then raise exception 'too many wilayas'; end if;
  for w in select * from jsonb_array_elements(p->'wilayas') loop
    v_code := (w->>'code')::smallint;
    if v_code < 1 or v_code > 58 then raise exception 'bad wilaya code %', v_code; end if;
    v_priced := coalesce((w->>'priced')::boolean, true);
    v_avail := coalesce((w->>'stopdesk_available')::boolean, true);
    v_home := coalesce((w->>'home_fee')::numeric, 0);
    v_desk := coalesce((w->>'stopdesk_fee')::numeric, 0);
    if v_home < 0 or v_desk < 0 or v_home in ('NaN', 'Infinity') or v_desk in ('NaN', 'Infinity') then
      raise exception 'fee must be a finite number >= 0';
    end if;
    if v_priced and (w->>'home_fee') is null then raise exception 'priced wilaya needs home_fee'; end if;
    if v_priced and v_avail and (w->>'stopdesk_fee') is null then raise exception 'stop-desk wilaya needs stopdesk_fee'; end if;
    v_total_communes := v_total_communes + coalesce(jsonb_array_length(w->'communes'), 0);
    if v_total_communes > 5000 then raise exception 'too many communes'; end if;
    if exists (select 1 from jsonb_array_elements_text(coalesce(w->'communes', '[]'::jsonb)) c
               where char_length(c) < 1 or char_length(c) > 100) then
      raise exception 'commune name length';
    end if;

    -- fees: an unpriced wilaya keeps its stored fees (priced=false hides them)
    update public.wilaya_fees wf set
        home_fee = case when v_priced then v_home else wf.home_fee end,
        stopdesk_fee = case when v_priced and v_avail then v_desk else wf.stopdesk_fee end,
        priced = v_priced,
        stopdesk_available = v_avail
      where wf.workspace_id = ws and wf.wilaya_code = v_code
        and (wf.priced is distinct from v_priced
             or wf.stopdesk_available is distinct from v_avail
             or (v_priced and wf.home_fee is distinct from v_home)
             or (v_priced and v_avail and wf.stopdesk_fee is distinct from v_desk));
    get diagnostics n = row_count;
    v_changed := v_changed + n;
    if not found then
      insert into public.wilaya_fees (workspace_id, wilaya_code, home_fee, stopdesk_fee, priced, stopdesk_available)
        values (ws, v_code, case when v_priced then v_home else 0 end,
                case when v_priced and v_avail then v_desk else 0 end, v_priced, v_avail)
        on conflict (workspace_id, wilaya_code) do nothing;
    end if;

    -- communes: replace the listed wilaya's set, touching only the difference
    delete from public.wilaya_communes c
      where c.workspace_id = ws and c.wilaya_code = v_code
        and c.name not in (select jsonb_array_elements_text(coalesce(w->'communes', '[]'::jsonb)));
    insert into public.wilaya_communes (workspace_id, wilaya_code, name)
      select distinct ws, v_code, x from jsonb_array_elements_text(coalesce(w->'communes', '[]'::jsonb)) x
      on conflict do nothing;
  end loop;
  return jsonb_build_object('fees_changed', v_changed);
end; $$;
revoke all on function public.apply_delivery_prices(jsonb) from public, anon;
grant execute on function public.apply_delivery_prices(jsonb) to authenticated;

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
  if a.delivery_status not in ('returning', 'returned') then
    raise exception 'swap not allowed from status %', a.delivery_status;
  end if;
  if p_customer_id is not null
     and not exists (select 1 from public.customers where id = p_customer_id and workspace_id = a.workspace_id) then
    raise exception 'customer must belong to the order''s workspace';
  end if;

  -- P1-7: refuse a delivery type the destination wilaya cannot ship (no fee row = no rule)
  if exists (
    select 1 from public.wilaya_fees wf
    where wf.workspace_id = a.workspace_id and wf.wilaya_code = p_wilaya_code
      and public.delivery_fee_for(wf.workspace_id, wf.wilaya_code, a.delivery_type::text) is null
  ) then
    raise exception 'delivery type % is not available in this wilaya', a.delivery_type;
  end if;

  perform set_config('mnw.swap_variant', '1', true);
  insert into public.orders(workspace_id, source, product_id, variant_id, variant, quantity, sale_price, delivery_fee,
      delivery_type, customer_id, customer_name, customer_phone, wilaya_code, commune, address,
      confirmation_status, delivery_status, placed_at)
  values (a.workspace_id, 'manual', a.product_id, a.variant_id, a.variant, a.quantity, a.sale_price,
      public.delivery_fee_for(a.workspace_id, p_wilaya_code, a.delivery_type::text),
      a.delivery_type, p_customer_id, p_customer_name, p_customer_phone, p_wilaya_code, nullif(p_commune, ''), nullif(p_address, ''),
      'confirmed', 'wait_for_deposit', now())
  returning id into v_b;
  perform set_config('mnw.swap_variant', '', true);

  -- link first (reconciles A -> 0 and B as a replacement on road), then A goes to 'swap' (D42)
  perform set_config('mnw.swap_link', '1', true);
  update public.orders set swapped_to_order_id = v_b where id = p_order_id;
  perform set_config('mnw.swap_link', '', true);
  perform set_config('mnw.swap_status', '1', true);
  perform public.transition_order_status(p_order_id, null, 'swap');
  perform set_config('mnw.swap_status', '', true);
  return v_b;
end; $$;
revoke all on function public.swap_order(uuid, uuid, text, text, smallint, text, text) from public, anon;
grant execute on function public.swap_order(uuid, uuid, text, text, smallint, text, text) to authenticated;
