# Phase 14h — Google Drive + Calendar (OAuth)

The heaviest item in the Phase 14 backlog and the only one that reverses a v2
simplification (no external OAuth). Split into **two independent slices** —
ship either without the other:

- **14h-1 — Drive**: product images upload to a workspace Google Drive folder,
  render from there. **Workspace-level** connection (one admin connects once).
- **14h-2 — Calendar**: meetings + assigned tasks create events on each team
  member's own Google Calendar, so they get native reminders. **Per-user**
  connection (every member connects their own account).

> **BLOCKED ON USER SETUP.** None of this can run until the user completes the
> Google Cloud console checklist (below) and provides the OAuth client id +
> secret. Surface that checklist first; do not scaffold blind.

---

## 0. What the user must provide (hand this back as a checklist)

1. A Google Cloud project.
2. **Enabled APIs**: Google Drive API (14h-1), Google Calendar API (14h-2).
3. **OAuth consent screen** configured (External, with the app name, support
   email, and the scopes below). While in "Testing" mode, every team member's
   Google email must be added as a test user, or Google blocks the consent.
4. **OAuth 2.0 Client (type: Web application)** → client id + client secret.
5. **Authorized redirect URIs** (both, so local + prod work):
   - `http://localhost:3000/auth/google/callback`
   - `${APP_URL}/auth/google/callback`
6. Env in `.env.local` (+ Vercel): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
   Never expose these to the client. `APP_URL` already exists.

**Least-privilege scopes** (request only these):
- Drive: `https://www.googleapis.com/auth/drive.file` — the app can only see/
  touch files **it created**, not the user's whole Drive.
- Calendar: `https://www.googleapis.com/auth/calendar.events` — events only.

---

## 1. Roadmap & order

| Step | Slice | Depends on | User action first |
|---|---|---|---|
| Shared OAuth plumbing (enum, callback route, token helpers) | both | — | GCloud client + env |
| Drive: connect + upload + render | 14h-1 | plumbing | Drive API enabled |
| Calendar: per-user connect + meeting sync + task sync | 14h-2 | plumbing | Calendar API enabled + test users |

If either slice outgrows a session, land the plumbing + Drive as `14h-1` and do
Calendar as `14h-2` in the next session. **Do not build a generic
"integration framework"** — two concrete providers, inline. That is the
ponytail line for this phase: the cost here is token refresh + consent + the
not-connected/revoked edge cases, not the API calls.

---

## 2. Application sections this touches

| Section | Route / file | Change |
|---|---|---|
| **Settings → Integrations** | `src/app/app/settings/integrations-section.tsx`, `settings/actions.ts` | Add a **Google Drive** card (workspace connect/disconnect + folder status) and a **Google Calendar** card that shows *the current user's* connection state + a "Connect my calendar" button. |
| **Products** | `src/app/app/products/product-form.tsx` | Replace the images **textarea of URLs** with a file upload → Drive → store returned URL in `products.images`. Keep manual-URL paste as a fallback (ponytail: don't delete the working path). |
| **Team → Meetings** | `src/app/app/team/meetings/actions.ts` (create/update/cancel) | After a meeting is written, push a calendar event to each connected attendee. Update on reschedule, delete on cancel. |
| **Team → Tasks** | `src/app/app/team/tasks/*` task create/assign/complete actions | On assign (owner set) with a `due_date`, create an all-day event on the owner's calendar; update on change, delete on unassign/complete. |
| **DB** | new migration | provider enum value, per-user token table, event-mapping table, Drive fields. Add all to `docs/DB.md`. |
| **lib** | new `src/lib/integrations/google.ts` | OAuth URL builder, code→token exchange, token refresh, Drive upload, Calendar upsert/delete. Server-only (imports admin/service where needed). |
| **Routes** | new `src/app/auth/google/callback/route.ts` | OAuth redirect handler — mirror the existing `src/app/auth/callback/route.ts` GET pattern. |

---

## 3. Schema (new migration `supabase/migrations/000NN_google_oauth.sql`)

```sql
-- provider enum: add google surfaces
alter type integration_provider add value if not exists 'google_drive';
-- (Calendar tokens are per-user, not in integration_configs — see below.)

-- 14h-1: workspace Drive connection reuses integration_configs
--   provider='google_drive', secret = refresh_token,
--   config = {"folder_id": "...", "connected_email": "...", "connected_by": "<uid>"}

-- 14h-2: per-user Google OAuth tokens (Calendar). integration_configs is
-- per-workspace, so Calendar needs its own per-user store.
create table public.google_oauth_tokens (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  refresh_token text not null,
  access_token  text,
  expires_at    timestamptz,
  scope         text,
  google_email  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.google_oauth_tokens enable row level security;
-- a user reads/writes ONLY their own row; admin may read (to see who's connected)
create policy got_own on public.google_oauth_tokens for all to authenticated
  using (user_id = auth.uid() and workspace_id = public.current_workspace_id())
  with check (user_id = auth.uid() and workspace_id = public.current_workspace_id());
create policy got_admin_sel on public.google_oauth_tokens for select to authenticated
  using (workspace_id = public.current_workspace_id() and public.is_admin());
create trigger set_updated_at before update on public.google_oauth_tokens
  for each row execute function public.set_updated_at();

-- event mapping: which Google event id represents a meeting/task on a given
-- user's calendar (so we can update/delete). Uniform for meetings + tasks.
create table public.google_calendar_events (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  source_type    text not null check (source_type in ('meeting','task')),
  source_id      uuid not null,
  google_event_id text not null,
  created_at     timestamptz not null default now(),
  unique (source_type, source_id, user_id)
);
alter table public.google_calendar_events enable row level security;
create policy gce_ws on public.google_calendar_events for all to authenticated
  using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());
```

- Regen types after: `npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts`.
- Add all three (enum value + two tables) to `docs/DB.md`.
- **Token-at-rest note**: this matches the existing pattern — ZR/webhook
  secrets are already plaintext in an admin-only, RLS-scoped column. Refresh
  tokens are more sensitive; if the user wants encryption, wrap with Supabase
  Vault / pgsodium. Leave a `ponytail:` comment naming this ceiling and the
  upgrade path; don't build Vault unless asked.

---

## 4. OAuth flow (both slices, in `src/lib/integrations/google.ts`)

Authorization-Code flow with offline access (to get a refresh token):

1. **Start** — build the consent URL with `client_id`, `redirect_uri`,
   `response_type=code`, `access_type=offline`, `prompt=consent`, the scope for
   the slice, and a signed **`state`** (CSRF: random nonce + which slice +
   return path; verify it in the callback). Redirect the user there.
2. **Callback** (`/auth/google/callback`) — verify `state`, exchange `code`
   for `{access_token, refresh_token, expires_in}` at Google's token endpoint.
   - 14h-1 (drive slice in state): upsert `integration_configs(provider=
     'google_drive')` with the refresh token + connected email; ensure a
     "MNW product images" Drive folder exists, store its `folder_id`.
   - 14h-2 (calendar slice): upsert the caller's `google_oauth_tokens` row.
3. **Refresh** — a `getGoogleAccessToken(userId|workspace)` helper returns a
   valid access token, refreshing via the stored refresh token when
   `expires_at` is past. All Google API calls go through it. Handle
   `invalid_grant` (revoked) by clearing the row and surfacing "reconnect".

Security: `state` is mandatory (CSRF). Consider PKCE. Never log tokens. The
callback route is the only public surface — validate `state` before doing
anything.

---

## 5. 14h-1 — Drive (product images)

- Settings card: admin "Connect Google Drive" (starts drive-slice OAuth) →
  shows connected email + folder + disconnect.
- `product-form.tsx`: file `<input type=file>` for images → server action uploads
  each to the workspace Drive folder via `drive.file`, sets the file permission
  to `anyone-with-link: reader` (so the app `<img>` can render it — same
  visibility as today's pasted URLs), stores the resulting link in
  `products.images`. Keep the URL-paste fallback.
- **Restate the flag to the user in the PR/handoff**: Drive files live outside
  the app's RLS; link-shared images are readable by anyone with the URL (no
  worse than the current pasted URLs, but not workspace-private). Supabase
  Storage would keep them inside the app's security model — user chose Drive
  anyway.

---

## 6. 14h-2 — Calendar (meetings + tasks)

- Settings card: **per-user** "Connect my Google Calendar" (starts
  calendar-slice OAuth for the current user) → shows their connected email +
  disconnect. Admin sees a roster of who's connected (via `got_admin_sel`).
- **Meetings** (`meetings.attendees uuid[]`, `scheduled_at`, `title`, default
  duration e.g. 60 min): on create/update, for each attendee **who is
  connected**, upsert a Calendar event (start=`scheduled_at`) and record the
  `google_event_id` in `google_calendar_events`. On reschedule → patch events.
  On cancel/delete → delete events. Attendees not connected are silently
  skipped.
- **Tasks** (`owner`, `due_date`, `title`): on assign with a `due_date`, create
  an **all-day** event on the owner's calendar for `due_date`; update on
  change; delete on unassign or when status → `done`.
- Reminders are Google's native calendar notifications — nothing to build app
  side beyond creating the event with default reminders.
- Do the sync in the existing server actions (best-effort, after the DB write):
  a Google API failure must **not** roll back the meeting/task write — catch,
  toast a soft warning, keep going. Leave a `ponytail:` comment: sync is
  fire-and-forget; add a retry queue only if drops become a real problem.

---

## 7. Acceptance

- Build + types green; new tables in `docs/DB.md`; `graphify update .` run.
- Drive: connect → upload an image on a product → it renders in the app; a
  second workspace/user can't see the raw token (RLS).
- Calendar: two seed users connect; creating a meeting with both as attendees
  puts the event on both calendars; rescheduling moves both; cancelling removes
  both; a task with a due date lands on the owner's calendar; an unconnected
  member is skipped without error.
- Revoke access in Google → the app shows "reconnect", doesn't crash.
- UI screenshot self-critique (both themes) for the Settings cards + product
  upload. Append a PROGRESS.md block; merge `--no-ff`.

---

## 8. Sonnet execution prompt (paste into the 14h chat)

```
Read CLAUDE.md, PROGRESS.md, then docs/phases/phase-14h-google-oauth.md IN FULL.
Also read docs/phases/phase-14-plan.md §14h for context. Execute Phase 14h only,
on branch mnw-14h. Read nothing else unless this file points you there.

PRE-FLIGHT (do not write code until confirmed): §0 lists what the user must set
up in Google Cloud (OAuth client, enabled APIs, redirect URIs, consent test
users) and the env vars GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET. If those env
vars are absent, STOP and hand the user the §0 checklist — do not scaffold blind.

Then build in this order (ship 14h-1 even if 14h-2 slips to a follow-up session):
  1. Shared plumbing: migration in §3 (provider enum + google_oauth_tokens +
     google_calendar_events), regen types, src/lib/integrations/google.ts
     (OAuth per §4: state/CSRF, code→token, refresh helper), and the callback
     route src/app/auth/google/callback/route.ts (mirror src/app/auth/callback/route.ts).
  2. 14h-1 Drive (§5): Settings connect card + product-form upload → Drive →
     store link in products.images, keep URL-paste fallback.
  3. 14h-2 Calendar (§6): per-user connect card + meeting sync + task sync,
     wired into the existing meetings/tasks server actions, best-effort
     (a Google failure must NOT roll back the DB write).

Rules: invoke ponytail:ponytail before writing code; two concrete providers
inline, NO generic integration framework; smallest correct token store. Server-
only for anything touching secrets (never import admin.ts / tokens into a client
component). Least-privilege scopes only (drive.file, calendar.events). CSRF
state is mandatory. Leave ponytail: comments for the named ceilings (plaintext
token at rest → Vault; fire-and-forget sync → retry queue).

Use graphify query to orient (not broad greps); no raw <input>/native <select>
(use components/fields/* + Radix); no hardcoded colors; every user-visible string
in src/messages/{en,ar}.json. When npm run build + npm test are green: run
ponytail:ponytail-review on the diff, graphify update ., screenshot the Settings
cards + product upload in BOTH themes and fix what they show, append a PROGRESS.md
block, merge --no-ff into mnw. Restate the Drive-RLS caveat (§5) in your handoff.
```
