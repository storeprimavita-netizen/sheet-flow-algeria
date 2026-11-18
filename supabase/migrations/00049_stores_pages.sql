-- ============================================================================
-- STORE-2: stores and store_pages. Public output is read only through the
-- server-only DAL (service role); no anon grant anywhere.
-- ============================================================================
create table public.stores (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  slug         text not null
    check (slug ~ '^[a-z0-9-]{2,40}$')
    check (slug not in ('app','api','login','s','auth')),
  name         text not null check (btrim(name) <> ''),
  status       text not null default 'draft' check (status in ('draft','live')),
  settings     jsonb not null default '{}'::jsonb,   -- phone, whatsapp, instagram, announcement, slogan. NEVER secrets
  theme        text not null default 'luxe-modesty',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, workspace_id)
);
create unique index stores_slug_uniq on public.stores (lower(slug));
create index stores_workspace_idx on public.stores (workspace_id);

create table public.store_pages (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  store_id     uuid not null,
  kind         text not null default 'product' check (kind in ('product','content')),
  product_id   uuid,
  slug         text not null
    check (slug ~ '^[a-z0-9-]{2,40}$'),
  title        text not null check (btrim(title) <> ''),
  status       text not null default 'draft' check (status in ('draft','published')),
  blocks       jsonb not null default '[]'::jsonb,
  seo          jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (status <> 'published' or kind <> 'product' or product_id is not null),
  unique (store_id, slug),
  unique (store_id, product_id),
  foreign key (store_id, workspace_id) references public.stores (id, workspace_id) on delete cascade,
  foreign key (product_id, workspace_id) references public.products (id, workspace_id) on delete set null (product_id)
);
create index store_pages_workspace_idx on public.store_pages (workspace_id);
create index store_pages_product_idx on public.store_pages (product_id);

create or replace function public.store_workspace_immutable()
returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if new.workspace_id is distinct from old.workspace_id then
    raise exception 'workspace_id cannot change';
  end if;
  return new;
end; $$;

do $$
declare t text;
begin
  foreach t in array array['stores','store_pages'] loop
    execute format('create trigger workspace_immutable before update on public.%I '
                   'for each row execute function public.store_workspace_immutable();', t);
    execute format('create trigger set_updated_at before update on public.%I '
                   'for each row execute function public.set_updated_at();', t);
    execute format('create trigger audit after insert or update or delete on public.%I '
                   'for each row execute function public.audit_row();', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke truncate, trigger, references on public.%I from authenticated', t);
  end loop;
end; $$;

-- stores: every role reads, admin writes
create policy stores_sel on public.stores for select to authenticated
  using (workspace_id = (select public.current_workspace_id()));
create policy stores_ins on public.stores for insert to authenticated
  with check (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()));
create policy stores_upd on public.stores for update to authenticated
  using (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()))
  with check (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()));
create policy stores_del on public.stores for delete to authenticated
  using (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()));

-- store_pages: admin only
create policy store_pages_sel on public.store_pages for select to authenticated
  using (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()));
create policy store_pages_ins on public.store_pages for insert to authenticated
  with check (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()));
create policy store_pages_upd on public.store_pages for update to authenticated
  using (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()))
  with check (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()));
create policy store_pages_del on public.store_pages for delete to authenticated
  using (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()));

revoke all on function public.store_workspace_immutable() from public, anon, authenticated;
