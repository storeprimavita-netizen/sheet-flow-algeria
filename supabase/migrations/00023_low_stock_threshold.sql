-- 15d: per-product low-stock threshold — drives the dashboard alert (15d) and
-- the stock hub badge (15g). Plain column on products: no new table/policy.
alter table public.products
  add column low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0);
