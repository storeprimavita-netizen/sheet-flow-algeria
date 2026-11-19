-- P1-7 review 2: wilayas that never got a fee are not priced; swap refuses a manually stopped wilaya.
update public.wilaya_fees set priced = false where home_fee = 0 and stopdesk_fee = 0 and priced;
alter table public.wilaya_fees alter column priced set default false;

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
      and (wf.stop_shipping or public.delivery_fee_for(wf.workspace_id, wf.wilaya_code, a.delivery_type::text) is null)
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
