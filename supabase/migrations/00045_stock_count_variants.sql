-- STORE-1 (D54.2): count by size. The admin types the number on the shelf per variant (ABSOLUTE counts);
-- for each size that differs, two linked lines (same count_id): variant +d, product-level -d.
-- products.stock (the total) does not change; what is left in "not assigned" is cleared by a normal correction.
create or replace function public.stock_count_variants(p_product uuid, p_counts jsonb)
returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  p public.products%rowtype;
  c record;
  v public.product_variants%rowtype;
  v_diff integer;
  v_count uuid;
  v_lines integer := 0;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'admin only'; end if;
  select * into p from public.products
    where id = p_product and workspace_id = public.current_workspace_id() for update;
  if not found then raise exception 'product not found'; end if;
  if p_counts is null or jsonb_typeof(p_counts) <> 'array' then raise exception 'counts must be an array'; end if;

  for c in
    select (e ->> 'variant_id')::uuid as variant_id, (e ->> 'count')::integer as cnt
    from jsonb_array_elements(p_counts) e
  loop
    if c.variant_id is null or c.cnt is null or c.cnt < 0 then raise exception 'invalid count'; end if;
    select * into v from public.product_variants
      where id = c.variant_id and product_id = p.id and workspace_id = p.workspace_id for update;
    if not found then raise exception 'variant does not belong to this product'; end if;
    v_diff := c.cnt - v.stock;
    continue when v_diff = 0;
    v_count := gen_random_uuid();
    insert into public.stock_movements(workspace_id, product_id, variant_id, delta, reason, count_id, created_by)
    values (p.workspace_id, p.id, v.id, v_diff, 'stock_count', v_count, auth.uid());
    insert into public.stock_movements(workspace_id, product_id, variant_id, delta, reason, count_id, created_by)
    values (p.workspace_id, p.id, null, -v_diff, 'stock_count', v_count, auth.uid());
    v_lines := v_lines + 1;
  end loop;
  return v_lines;   -- number of sizes that changed
end; $$;
revoke all on function public.stock_count_variants(uuid, jsonb) from public, anon, service_role;
grant execute on function public.stock_count_variants(uuid, jsonb) to authenticated;
