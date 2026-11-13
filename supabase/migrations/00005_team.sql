-- ============================================================================
-- MNW COD ERP v2 — rules docs, meetings
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) rules_docs  (markdown blocks: store rules, product criteria, duties)
-- ---------------------------------------------------------------------------
create table public.rules_docs (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title        text not null,
  content      text not null default '',    -- markdown
  position     integer not null default 0,
  updated_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2) meetings + meeting_objectives
--    Recurring template lives in settings key 'meeting_schedule'; instances
--    are rows here. A meeting cannot be marked 'held' before its objectives
--    checklist has at least one item (trigger below).
-- ---------------------------------------------------------------------------
create table public.meetings (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title        text not null default 'Team meeting',
  scheduled_at timestamptz not null,
  status       meeting_status not null default 'planned',
  notes        text,                        -- decisions, filled after
  attendees    uuid[] not null default '{}',
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index meetings_ws_sched_idx on public.meetings (workspace_id, scheduled_at desc);

create table public.meeting_objectives (
  id         uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  content    text not null,
  is_done    boolean not null default false,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

create or replace function public.guard_meeting_held()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'held' and old.status is distinct from 'held'
     and not exists(select 1 from public.meeting_objectives where meeting_id = new.id) then
    raise exception 'fill the objectives checklist before marking a meeting as held';
  end if;
  return new;
end; $$;

create trigger meetings_guard_held
  before update on public.meetings
  for each row execute function public.guard_meeting_held();

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
create trigger set_updated_at before update on public.rules_docs
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.meetings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY — rules readable by the whole team, writable by admin;
-- meetings admin-managed (agents read to see the next-meeting card if needed)
-- ---------------------------------------------------------------------------
alter table public.rules_docs         enable row level security;
alter table public.meetings           enable row level security;
alter table public.meeting_objectives enable row level security;

create policy rd_sel on public.rules_docs for select to authenticated
  using (workspace_id = public.current_workspace_id());
create policy rd_all on public.rules_docs for all to authenticated
  using (workspace_id = public.current_workspace_id() and public.is_admin())
  with check (workspace_id = public.current_workspace_id() and public.is_admin());

create policy m_sel on public.meetings for select to authenticated
  using (workspace_id = public.current_workspace_id());
create policy m_all on public.meetings for all to authenticated
  using (workspace_id = public.current_workspace_id() and public.is_admin())
  with check (workspace_id = public.current_workspace_id() and public.is_admin());

create policy mo_sel on public.meeting_objectives for select to authenticated
  using (exists(select 1 from public.meetings m where m.id = meeting_id
                and m.workspace_id = public.current_workspace_id()));
create policy mo_all on public.meeting_objectives for all to authenticated
  using (exists(select 1 from public.meetings m where m.id = meeting_id
                and m.workspace_id = public.current_workspace_id() and public.is_admin()))
  with check (exists(select 1 from public.meetings m where m.id = meeting_id
                and m.workspace_id = public.current_workspace_id() and public.is_admin()));
