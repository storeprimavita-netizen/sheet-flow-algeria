-- ============================================================================
-- STORE-7: customer reviews recorded by an admin (no public submission).
-- Admin-only table; the public page reads approved rows through the
-- server-only DAL (service role) which returns a DTO with no ids.
-- ============================================================================
create table public.reviews (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id   uuid not null,
  name         text not null check (btrim(name) <> '' and char_length(name) <= 80),
  rating       smallint not null check (rating between 1 and 5),
  body         text not null check (btrim(body) <> '' and char_length(body) <= 1000),
  order_id     uuid,
  approved     boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  foreign key (product_id, workspace_id) references public.products (id, workspace_id) on delete cascade,
  foreign key (order_id, workspace_id) references public.orders (id, workspace_id) on delete set null (order_id)
);
create index reviews_product_idx on public.reviews (product_id, approved, created_at desc);
create index reviews_order_idx on public.reviews (order_id, workspace_id);
create index reviews_workspace_idx on public.reviews (workspace_id);

create trigger workspace_immutable before update on public.reviews
  for each row execute function public.store_workspace_immutable();
create trigger set_updated_at before update on public.reviews
  for each row execute function public.set_updated_at();
create trigger audit after insert or update or delete on public.reviews
  for each row execute function public.audit_row();

alter table public.reviews enable row level security;
revoke all on public.reviews from anon, authenticated;
grant select, insert, update, delete on public.reviews to authenticated;

create policy reviews_sel on public.reviews for select to authenticated
  using (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()));
create policy reviews_ins on public.reviews for insert to authenticated
  with check (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()));
create policy reviews_upd on public.reviews for update to authenticated
  using (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()))
  with check (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()));
create policy reviews_del on public.reviews for delete to authenticated
  using (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()));
