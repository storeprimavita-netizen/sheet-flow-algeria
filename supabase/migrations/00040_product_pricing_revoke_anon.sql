-- product_pricing is admin-only financial data: no anon grants at all (RLS already blocks, this removes the surface).
revoke all on public.product_pricing from anon;
