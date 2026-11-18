-- STORE-1 (D54): turn each valid products.variants entry [{label, sku}] into option "Variant" + value + variant.
-- Stock 0 on every variant (the total stays on the product as "not assigned"). products.variants is kept.
-- Idempotent: a label that already exists as a value of the product is skipped, so a re-run adds nothing.
do $$
declare
  p record; e jsonb; v_label text; v_sku text; v_opt uuid; v_val uuid; v_var uuid; v_pos integer;
begin
  for p in select id, workspace_id, variants from public.products where jsonb_typeof(variants) = 'array' loop
    v_opt := null;
    for e in select value from jsonb_array_elements(p.variants) loop
      continue when jsonb_typeof(e) is distinct from 'object' or jsonb_typeof(e -> 'label') is distinct from 'string';
      v_label := btrim(e ->> 'label');
      continue when v_label = '';
      continue when exists (select 1 from public.product_option_values x
                            where x.product_id = p.id and lower(btrim(x.label)) = lower(v_label));
      if v_opt is null then
        select id into v_opt from public.product_options where product_id = p.id and name = 'Variant' order by position limit 1;
        if v_opt is null then
          insert into public.product_options(workspace_id, product_id, name, position)
          values (p.workspace_id, p.id, 'Variant', 0) returning id into v_opt;
        end if;
      end if;
      select coalesce(max(position) + 1, 0) into v_pos from public.product_option_values where option_id = v_opt;
      insert into public.product_option_values(workspace_id, product_id, option_id, label, position)
      values (p.workspace_id, p.id, v_opt, v_label, v_pos) returning id into v_val;
      v_sku := case when jsonb_typeof(e -> 'sku') = 'string' then nullif(btrim(e ->> 'sku'), '') end;
      insert into public.product_variants(workspace_id, product_id, sku) values (p.workspace_id, p.id, v_sku) returning id into v_var;
      insert into public.product_variant_values(variant_id, option_id, value_id, product_id, workspace_id)
      values (v_var, v_opt, v_val, p.id, p.workspace_id);
    end loop;
  end loop;
end; $$;
