-- ============================================================================
-- MNW COD ERP — stock / inventory (Phase 11)
-- File: supabase/migrations/00008_stock.sql
--
-- products.stock is a cached on-hand quantity, kept in sync by a trigger from
-- an append-only stock_movements log (every change is audited). Low-stock
-- threshold is a single app_setting (stock_low_threshold, default 5).
-- ============================================================================

alter table public.products
  add column if not exists stock integer not null default 0;

create table if not exists public.stock_movements (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  delta       integer not null,                       -- +restock / -outflow
  reason      text not null check (reason in ('initial','restock','order','return','adjustment','removal')),
  reference   text,                                   -- free-form (order id, supplier…)
  note        text,
  created_by  uuid default auth.uid() references auth.users(id),
  created_at  timestamptz not null default now()
);

create index if not exists stock_movements_product_idx
  on public.stock_movements (product_id, created_at desc);

-- keep products.stock in sync with the movement log (clamped at 0)
create or replace function public.apply_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = public as $$
begin
  update public.products
     set stock = greatest(0, stock + new.delta)
   where id = new.product_id;
  return new;
end; $$;

drop trigger if exists stock_movements_apply on public.stock_movements;
create trigger stock_movements_apply
  after insert on public.stock_movements
  for each row execute function public.apply_stock_movement();

alter table public.stock_movements enable row level security;

drop policy if exists sm_sel on public.stock_movements;
drop policy if exists sm_ins on public.stock_movements;
drop policy if exists sm_del on public.stock_movements;

-- everyone can see stock; only admins change it
create policy sm_sel on public.stock_movements
  for select to authenticated using (true);
create policy sm_ins on public.stock_movements
  for insert to authenticated with check (public.is_admin());
create policy sm_del on public.stock_movements
  for delete to authenticated using (public.is_admin());

-- global low-stock threshold
insert into public.app_settings (key, value) values ('stock_low_threshold', '5')
  on conflict (key) do nothing;
