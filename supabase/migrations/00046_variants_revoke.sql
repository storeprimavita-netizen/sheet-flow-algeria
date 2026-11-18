-- STORE-1: new functions are not callable by anon. Trigger functions need no EXECUTE to fire;
-- variant_label runs inside the order trigger as the caller, so signed-in users and the service role keep it.
revoke all on function public.product_id_immutable() from public, anon, authenticated;
revoke all on function public.product_variants_stock_guard() from public, anon, authenticated;
revoke all on function public.product_variant_values_unique_set() from public, anon, authenticated;
revoke all on function public.orders_variant_label() from public, anon, authenticated;
revoke all on function public.variant_label(uuid) from public, anon;
grant execute on function public.variant_label(uuid) to authenticated, service_role;
