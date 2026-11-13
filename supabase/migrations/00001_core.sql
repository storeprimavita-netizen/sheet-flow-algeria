-- ============================================================================
-- MNW COD ERP v2 — core: workspaces, profiles, RBAC helpers, audit log
-- Rebaseline (2026-07-26). Legacy v1 schema lives in supabase/migrations_legacy/
-- and must be DROPPED before applying this set (dev data only — see docs/DB.md
-- §"Applying the rebaseline").
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
create type app_role            as enum ('admin','confirmation_agent','delivery_agent');
create type product_status      as enum ('to_be_tested','tested','confirmed','cancelled');
create type confirmation_status as enum ('wait_for_confirmation','no_answer','closed_phone','cancelled','confirmed');
create type delivery_status     as enum ('wait_for_deposit','bureau_deposited','in_transit','out_for_delivery','stop_desk_waiting','delivered','cancelled','delayed','returning','returned');
create type supplier_type       as enum ('shooting_studio','atelier_couture','emballage','other');
create type expense_category    as enum ('shooting','packaging','sampling','confirmation','delivery','test_ads','scaling_ads','other');
create type currency_code       as enum ('DZD','USD','EUR');
create type order_source        as enum ('shopify','lightfunnels','manual');
create type delivery_type       as enum ('home','stopdesk');
create type delivery_fee_source as enum ('payload','wilaya_table','manual');
create type ad_kind             as enum ('test','scaling');
create type stock_reason        as enum ('purchase','correction','delivered','returned');
create type integration_provider as enum ('shopify','lightfunnels');
create type meeting_status      as enum ('planned','held','cancelled');
create type cash_status         as enum ('collected','deposited');

-- ---------------------------------------------------------------------------
-- 1) workspaces  (SaaS root — every business table hangs off this)
-- ---------------------------------------------------------------------------
create table public.workspaces (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2) profiles  (user ↔ workspace ↔ role; replaces v1 user_roles + team_roles)
-- ---------------------------------------------------------------------------
create table public.profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete set null,
  role         app_role not null default 'confirmation_agent',
  display_name text,
  duty         text,
  is_active    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- RBAC helpers (security definer → bypass RLS, no recursion)
create or replace function public.current_workspace_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select workspace_id from public.profiles
  where user_id = auth.uid() and is_active;
$$;

create or replace function public.current_app_role()
returns text
language sql stable security definer set search_path = public as $$
  select role::text from public.profiles
  where user_id = auth.uid() and is_active;
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'admin' and is_active);
$$;

-- New signups get an INACTIVE profile with no workspace; an admin (or the
-- bootstrap function) activates them. current_workspace_id() = null ⇒ RLS
-- shows them nothing.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(user_id, role, is_active, display_name)
  values (new.id, 'confirmation_agent', false, new.raw_user_meta_data->>'display_name')
  on conflict (user_id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only admins may grant/revoke admin or move users across workspaces
-- (allowed when NO admin exists yet, so bootstrap can run).
create or replace function public.guard_profiles()
returns trigger
language plpgsql security definer set search_path = public as $$
declare admin_exists boolean;
begin
  select exists(select 1 from public.profiles where role = 'admin' and is_active)
    into admin_exists;
  if not admin_exists then return new; end if;   -- bootstrap window
  if public.is_admin() or auth.uid() is null then return new; end if;  -- null uid = service role / SQL editor
  if tg_op = 'UPDATE'
     and (new.role is distinct from old.role
          or new.workspace_id is distinct from old.workspace_id
          or new.is_active is distinct from old.is_active) then
    raise exception 'only admins can change role, workspace, or activation';
  end if;
  return new;
end; $$;

create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.guard_profiles();

-- One-shot single-tenant bootstrap: first workspace + first admin.
-- Refuses once any workspace exists (SaaS signup flow replaces this later).
create or replace function public.bootstrap_workspace(p_email text, p_workspace_name text default 'MNW')
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_uid uuid; v_ws uuid;
begin
  if exists(select 1 from public.workspaces) then
    raise exception 'a workspace already exists; use the admin UI to invite users';
  end if;
  select id into v_uid from auth.users where email = p_email;
  if v_uid is null then
    raise exception 'auth user with email % not found — sign up first', p_email;
  end if;
  insert into public.workspaces(name) values (p_workspace_name) returning id into v_ws;
  insert into public.profiles(user_id, workspace_id, role, is_active)
  values (v_uid, v_ws, 'admin', true)
  on conflict (user_id) do update
    set workspace_id = excluded.workspace_id, role = 'admin', is_active = true;
  perform public.seed_workspace(v_ws);   -- defined in 00007_seed.sql
  return v_ws;
end; $$;

-- ---------------------------------------------------------------------------
-- updated_at maintenance (attach per-table in each migration)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

create trigger set_updated_at before update on public.workspaces
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3) audit_log  (who/what/when/old→new; admin-visible)
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id           bigint generated always as identity primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  actor        uuid,                    -- auth.uid(); null = webhook/service
  table_name   text not null,
  row_id       text,
  action       text not null check (action in ('INSERT','UPDATE','DELETE')),
  old_row      jsonb,
  new_row      jsonb,
  created_at   timestamptz not null default now()
);
create index audit_log_ws_created_idx on public.audit_log (workspace_id, created_at desc);

-- Generic row auditor. Attach with:
--   create trigger audit after insert or update or delete on <t>
--     for each row execute function public.audit_row();
create or replace function public.audit_row()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_ws uuid; v_id text;
begin
  if tg_op = 'DELETE' then
    v_ws := (to_jsonb(old)->>'workspace_id')::uuid;
    v_id := to_jsonb(old)->>'id';
  else
    v_ws := (to_jsonb(new)->>'workspace_id')::uuid;
    v_id := to_jsonb(new)->>'id';
  end if;
  insert into public.audit_log(workspace_id, actor, table_name, row_id, action, old_row, new_row)
  values (v_ws, auth.uid(), tg_table_name, v_id, tg_op,
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return case when tg_op = 'DELETE' then old else new end;
end; $$;

-- ---------------------------------------------------------------------------
-- Phone normalization (Algeria): +213 / 00213 / bare 9-digit → 0XXXXXXXXX
-- ---------------------------------------------------------------------------
create or replace function public.normalize_dz_phone(p text)
returns text
language sql immutable as $$
  select case when p is null then null else (
    with d as (select regexp_replace(p, '\D', '', 'g') s)
    select case
      when s ~ '^00213[567]\d{8}$' then '0' || substr(s, 6)
      when s ~ '^213[567]\d{8}$'   then '0' || substr(s, 4)
      when s ~ '^[567]\d{8}$'      then '0' || s
      else s
    end from d
  ) end;
$$;

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
alter table public.workspaces enable row level security;
alter table public.profiles   enable row level security;
alter table public.audit_log  enable row level security;

create policy ws_sel on public.workspaces for select to authenticated
  using (id = public.current_workspace_id());
create policy ws_upd on public.workspaces for update to authenticated
  using (id = public.current_workspace_id() and public.is_admin())
  with check (id = public.current_workspace_id() and public.is_admin());

-- profiles: everyone sees teammates (names for assignment dropdowns);
-- self may edit display_name; admin edits everything (guard trigger gates
-- role/workspace/activation). Inserts come from the auth trigger / admin API.
create policy pr_sel on public.profiles for select to authenticated
  using (user_id = auth.uid()
         or (workspace_id is not null and workspace_id = public.current_workspace_id()));
create policy pr_upd on public.profiles for update to authenticated
  using (user_id = auth.uid()
         or (public.is_admin() and workspace_id = public.current_workspace_id()))
  with check (user_id = auth.uid()
         or (public.is_admin() and workspace_id = public.current_workspace_id()));
create policy pr_del on public.profiles for delete to authenticated
  using (public.is_admin() and workspace_id = public.current_workspace_id());

-- audit_log: admin read; writes happen via the security-definer trigger only.
create policy al_sel on public.audit_log for select to authenticated
  using (workspace_id = public.current_workspace_id() and public.is_admin());
