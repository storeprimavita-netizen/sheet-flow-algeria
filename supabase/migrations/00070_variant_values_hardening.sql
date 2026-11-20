-- STORE-1-G: (1) authenticated cannot TRUNCATE / TRIGGER / REFERENCES the variant tables (DML stays, RLS gates it);
-- (2) an existing product_variant_values row can never change (all columns are identity), incl. the
-- INSERT .. ON CONFLICT DO UPDATE path; (3) guard: no size may exist without value rows.

do $$
declare t text;
begin
  foreach t in array array['product_options','product_option_values','product_variants','product_variant_values'] loop
    execute format('revoke truncate, trigger, references on public.%I from authenticated', t);
  end loop;
end; $$;

create or replace function public.product_variant_values_immutable()
returns trigger
language plpgsql set search_path = '' as $$
begin
  if row(new.*) is distinct from row(old.*) then
    raise exception 'product_variant_values rows are immutable; delete and insert instead';
  end if;
  return new;
end; $$;
revoke all on function public.product_variant_values_immutable() from public, anon, authenticated;

create trigger product_variant_values_immutable
  before update on public.product_variant_values
  for each row execute function public.product_variant_values_immutable();

-- guard:begin
do $$
declare n int;
begin
  select count(*) into n from public.product_variants v
  where not exists (select 1 from public.product_variant_values x where x.variant_id = v.id);
  if n > 0 then
    raise exception 'guard: % size(s) have no value rows; give them values (or delete them) before applying', n;
  end if;
end; $$;
-- guard:end
