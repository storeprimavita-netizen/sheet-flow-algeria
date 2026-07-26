-- ============================================================================
-- MNW COD ERP — team_directory view (Phase 6)
-- File: supabase/migrations/00003_team_directory.sql
--
-- auth.users is NOT exposed over Postgrest, so the Team page can't read emails
-- directly. This postgres-owned view joins auth.users + user_roles + team_roles
-- and restricts rows to admins (is_admin()), giving the admin Team page the
-- directory it needs without exposing emails to agents.
--
-- Apply via:  Supabase Dashboard → SQL Editor → paste & run
-- Then regenerate types so `team_directory` is typed from the DB.
-- ============================================================================

create or replace view public.team_directory as
select u.id        as user_id,
       u.email     as email,
       ur.role     as role,
       tr.duty     as duty,
       tr.slack_user_id      as slack_user_id,
       tr.slack_channel_id   as slack_channel_id,
       tr.meeting_late_minutes as meeting_late_minutes,
       coalesce(tr.is_active, false) as is_team_member
from auth.users u
left join public.user_roles ur on ur.user_id = u.id
left join public.team_roles tr on tr.user_id = u.id
where public.is_admin();
