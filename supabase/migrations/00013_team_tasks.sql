-- ============================================================================
-- MNW COD ERP v2 — Tasks (Phase 12 §7) + meeting-objective carry-over
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) tasks — kanban by status, optional link to a meeting or a product
-- ---------------------------------------------------------------------------
create type task_status   as enum ('todo','doing','blocked','done');
create type task_priority as enum ('low','medium','high');

create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title        text not null,
  owner        uuid references auth.users(id),
  due_date     date,
  priority     task_priority not null default 'medium',
  status       task_status not null default 'todo',
  meeting_id   uuid references public.meetings(id) on delete set null,
  product_id   uuid references public.products(id) on delete set null,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index tasks_ws_status_idx on public.tasks (workspace_id, status);
create index tasks_ws_owner_idx on public.tasks (workspace_id, owner);

create trigger set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

alter table public.tasks enable row level security;

-- Same shape as meetings: team-wide read, admin-managed writes (00005_team.sql).
create policy tasks_sel on public.tasks for select to authenticated
  using (workspace_id = public.current_workspace_id());
create policy tasks_all on public.tasks for all to authenticated
  using (workspace_id = public.current_workspace_id() and public.is_admin())
  with check (workspace_id = public.current_workspace_id() and public.is_admin());

-- ---------------------------------------------------------------------------
-- 2) meeting_objectives — deferred/carry-over tagging
--    A deferred objective (checked "won't do this time") satisfies the
--    held-guard instead of blocking it; `carried_forward` marks it as already
--    copied into a later meeting so it isn't copied twice; `carried_from`
--    on the copy links back to the original for the "carried over" tag.
-- ---------------------------------------------------------------------------
alter table public.meeting_objectives
  add column is_deferred     boolean not null default false,
  add column carried_forward boolean not null default false,
  add column carried_from    uuid references public.meeting_objectives(id) on delete set null;

create or replace function public.guard_meeting_held()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'held' and old.status is distinct from 'held' then
    if not exists(select 1 from public.meeting_objectives where meeting_id = new.id) then
      raise exception 'fill the objectives checklist before marking a meeting as held';
    end if;
    if exists(
      select 1 from public.meeting_objectives
      where meeting_id = new.id and not is_done and not is_deferred
    ) then
      raise exception 'every objective must be checked or deferred before marking a meeting as held';
    end if;
  end if;
  return new;
end; $$;
