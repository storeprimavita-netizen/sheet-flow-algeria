-- CONF-1: saved order views (filters + sort + stored columns), shared or personal.
-- owner_id null = shared (admin writes); owner_id = user = personal.

create table public.order_views (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade,
  seed_key text,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  emoji text check (char_length(emoji) <= 16),
  scope text not null check (scope in ('confirmation', 'shipping', 'all')),
  layout text not null default 'table' check (layout in ('table', 'kanban')),
  config jsonb not null default '{}'::jsonb
    check (jsonb_typeof(config) = 'object' and octet_length(config::text) < 4096),
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index order_views_scope_idx on public.order_views (workspace_id, scope, position);
create unique index order_views_shared_name_uq on public.order_views (workspace_id, scope, lower(name)) where owner_id is null;
create unique index order_views_own_name_uq on public.order_views (owner_id, scope, lower(name)) where owner_id is not null;
create unique index order_views_seed_uq on public.order_views (workspace_id, seed_key) where seed_key is not null;

create trigger set_updated_at before update on public.order_views
  for each row execute function public.set_updated_at();

create or replace function public.order_views_immutable()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.owner_id is distinct from old.owner_id or new.workspace_id is distinct from old.workspace_id then
    raise exception 'order view owner and workspace cannot change';
  end if;
  return new;
end; $$;
create trigger order_views_immutable before update on public.order_views
  for each row execute function public.order_views_immutable();

alter table public.order_views enable row level security;
revoke all on public.order_views from anon;

create policy order_views_select on public.order_views for select to authenticated
  using (workspace_id = (select public.current_workspace_id())
         and (owner_id is null or owner_id = (select auth.uid())));
create policy order_views_insert on public.order_views for insert to authenticated
  with check (workspace_id = (select public.current_workspace_id())
              and (owner_id = (select auth.uid()) or (owner_id is null and (select public.is_admin()))));
create policy order_views_update on public.order_views for update to authenticated
  using (workspace_id = (select public.current_workspace_id())
         and (owner_id = (select auth.uid()) or (owner_id is null and (select public.is_admin()))))
  with check (workspace_id = (select public.current_workspace_id())
              and (owner_id = (select auth.uid()) or (owner_id is null and (select public.is_admin()))));
create policy order_views_delete on public.order_views for delete to authenticated
  using (workspace_id = (select public.current_workspace_id())
         and (owner_id = (select auth.uid()) or (owner_id is null and (select public.is_admin()))));

-- Seeds: idempotent on seed_key; a deleted seed is never recreated because the
-- trigger only fires when a workspace is created.
create or replace function public.seed_order_views(ws uuid)
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.order_views (workspace_id, owner_id, seed_key, name, scope, config, position)
  values
    (ws, null, 'new', 'New', 'confirmation', '{"confirmation_status":["wait_for_confirmation"]}', 0),
    (ws, null, 'no_answer', 'No answer', 'confirmation', '{"confirmation_status":["no_answer","closed_phone"]}', 1),
    (ws, null, 'duplicates', 'Duplicates', 'all', '{"duplicates":"1"}', 0)
  on conflict (workspace_id, seed_key) where seed_key is not null do nothing;
$$;
revoke execute on function public.seed_order_views(uuid) from public, anon, authenticated;

create or replace function public.order_views_seed_for_workspace()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.seed_order_views(new.id);
  return new;
end; $$;
revoke execute on function public.order_views_seed_for_workspace() from public, anon, authenticated;

create trigger workspaces_seed_order_views after insert on public.workspaces
  for each row execute function public.order_views_seed_for_workspace();

select public.seed_order_views(id) from public.workspaces;
