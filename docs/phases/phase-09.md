# Phase 9 — Team & Rules

**Read first:** CLAUDE.md, PROGRESS.md, docs/SPEC.md §8, docs/DB.md
(profiles, rules_docs, meetings, agent_performance, audit_log).

## Goal

Team & Rules section: user management with invites, rules docs, meetings,
agent performance, audit log viewer.

## Pages (/app/team, admin-only except where noted)

1. **Users** — list profiles (name, email, role, duty, active). Invite by
   email: server route using the service-role client
   (`auth.admin.inviteUserByEmail`), then set role/workspace/duty on the
   created profile. Deactivate toggle (is_active=false kills access via
   `current_workspace_id()` → null). Role changes guarded by the DB trigger —
   surface its errors nicely.
2. **Rules** — CRUD markdown blocks (`rules_docs`), drag-free ordering via
   position field (up/down buttons fine). Render markdown (tiny renderer or
   plain `whitespace-pre-wrap` + minimal md — no heavy editor deps).
   Agents: read-only view.
3. **Meetings** — upcoming list generated from `settings.meeting_schedule`
   ("create next instances" button, no cron), instance page: objectives
   checklist (add/check items), mark held (DB trigger enforces objectives
   exist — surface the error), notes/decisions, attendees multi-select.
   Next-meeting card on Dashboard now links here.
4. **Performance** — `agent_performance` per user: confirmation rate, avg
   decision time (format interval humanely), orders handled; delivery rate
   for delivery agents. Date scoping optional (view is all-time; if needed,
   query `order_status_history` directly with a range).
5. **Audit log** — filterable table over `audit_log` (table, actor, date),
   old→new diff rendered as compact key changes.

## Acceptance criteria

- Full invite flow works on the dev project (invited user receives email /
  or use the generated link), lands as inactive-until-assigned or directly
  assigned — document which.
- Meeting cannot be marked held without objectives (error surfaces).
- Performance numbers match a hand computation from history rows.
- Audit page shows Phase-2 settings edits.
- Agents: /app/team redirects away (except rules read view if linked).
- `npm run build` green.
