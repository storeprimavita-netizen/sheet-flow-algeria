-- ============================================================================
-- MNW COD ERP — app_settings (Phase 4)
-- File: supabase/migrations/00002_app_settings.sql
--
-- Key/value store for integration secrets (HMAC webhook secrets, Slack token).
-- Admin-only via RLS. Webhook routes read these via the service-role client.
--
-- Apply via:  Supabase Dashboard → SQL Editor → paste & run
--
-- Production note: for true secret management prefer Supabase Vault / env vars
-- over a plaintext table; this is the pragmatic MVP boundary (admin-only RLS).
-- ============================================================================

create table if not exists public.app_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

-- Admin-only CRUD (reuses is_admin() from 00001_init.sql).
drop policy if exists as_sel on public.app_settings;
drop policy if exists as_ins on public.app_settings;
drop policy if exists as_upd on public.app_settings;
drop policy if exists as_del on public.app_settings;

create policy as_sel on public.app_settings for select to authenticated
  using (public.is_admin());
create policy as_ins on public.app_settings for insert to authenticated
  with check (public.is_admin());
create policy as_upd on public.app_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy as_del on public.app_settings for delete to authenticated
  using (public.is_admin());

create trigger set_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();
