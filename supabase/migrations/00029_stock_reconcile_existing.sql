-- P0-8 (D34): one-time pass so existing orders hold stock by the new three-stage rule.
-- Runs in its own migration: a new enum value (order_stock_sync, 00028) cannot be used in DML in the
-- transaction that adds it. Idempotent: a second run finds target = current everywhere and writes nothing.
do $$
declare r record;
begin
  for r in select id, product_id from public.orders where product_id is not null loop
    perform public.stock_reconcile_order(r.id, null, 'order_stock_sync', null);
  end loop;
end; $$;
