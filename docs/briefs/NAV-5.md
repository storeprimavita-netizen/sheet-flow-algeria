risk: high · surface: ui,security · lane: shell
(plan says L/no-migration; stays no-migration per D86. risk high kept because role landing pages and guards are checked by qa-reviewer)

# NAV-5 — Mobile bottom bar + agent "My day" home

Goal: under 768 px every role gets a bottom bar (role's top destinations + More = existing drawer), and agents land on a read-only "My day" page instead of being bounced to their queue.

## Done when
- `<md`: fixed bottom bar, 44 px targets, safe-area padding, active state, counters; admin = Home · Confirmation · Orders · Money · More; confirmation agent = My day · Confirmation · More; delivery agent = My day · Shipping · More (D86: no Tasks in the agent bar). `>=md`: no bar, sidebar unchanged.
- "More" opens the current drawer (`open` state in app-shell); the header hamburger is removed on mobile only if the bar replaces it (keep one way in, not two).
- Agent `/app/my-day`: queue count (same filter as layout counters), my open tasks (owner = me, read-only), next scheduled meeting (read-only), my numbers (D86: counts only, read with the agent's own session). No money, no cost fields, no rates.
- No link to a page RLS/guard refuses: spec's agent bar "Tasks" is NOT built (team/tasks is admin-guarded, nav `adminOnly`); tasks/meetings on My day are plain rows, no links.
- Agents land on My day after login and from `/app/orders`, `/app/dashboard` guard, not-found "back"; admin unchanged. Admin opening `/app/my-day` redirects to dashboard.
- Gate green; screenshots clean.

## Facts found in code
- `src/components/app-shell.tsx` (437 l): drawer state `open`, `inert` on content while open, `max-md:` classes; `nav-model.tsx`: `HOME` (adminOnly), `visibleNav(role)` gives agents `home:null` + one leaf; counters come from `app/(app)/app/layout.tsx` (confirmation/delivery/tasks, RLS-scoped).
- Landing today: `(app)/page.tsx` and `login/page.tsx` -> `/app/dashboard` -> `AdminGuardLayout` -> `/app/orders` -> role redirect (`orders/page.tsx`); `not-found.tsx` home = `/app/orders`; `requireAdmin` default `/app/dashboard`.
- RLS (D86, supersedes the earlier premise): `tasks_sel`/`m_sel` team-wide read. Since 00025 (`o_sel`) a confirmation agent reads the open queue AND every order assigned to them, any status; `transition_order_status` (00030) assigns an unassigned order to the agent on change. So own confirmations are visible. `order_status_history` columns: `order_id, stage, from_status, to_status, actor, created_at`.
- Known limit (accepted, D86): an order assigned to another agent that I confirmed is outside my view and not counted.
- Spec/table drift: spec bar lists "Tasks" for agents; stale (see above). "Home" for agent was meant as My day.

## Decided (D86) — no open question
My numbers = `order_status_history` on the session client: `actor` = me, `stage='confirmation'`, `created_at` >= start of today Africa/Algiers (UTC+1). Each order counted once under my last change today: confirmed / cancelled / to call again (any other); handled = sum. Counts only. Delivery agent: plain RLS queries on own delivered/returned. No `my_day_stats()`, no migration 00077, no types regen, no DB.md change. Whether agents get Team pages: Q-29 (owner), not built.

## Files
- `src/components/nav-model.tsx`: add `MY_DAY` leaf (`/app/my-day`, icon `Sun`/`CalendarCheck`), `home` for agents = MY_DAY, new `bottomBar(role): NavLeaf[]` (max 4 + More, derived from model, no hardcoded hrefs elsewhere).
- `src/components/mobile-bottom-bar.tsx` (new, client): `<nav aria-label>`, `<Link>`s, More = `<button>`; counters via `nav-counts.tsx`; logical props only, tokens only.
- `src/components/app-shell.tsx`: render bar `md:hidden`, `pb` on main for bar + `env(safe-area-inset-bottom)`, More opens drawer; focus returns to More on close.
- `src/app/(app)/app/my-day/{page,loading}.tsx` + `layout.tsx` (guard: admin -> `/app/dashboard`); page uses session client only; PageHeader with purpose line; four states.
- `src/lib/role-home.ts` (new): `roleHome(role)`; use in `login/page.tsx`, `orders/page.tsx`, `not-found.tsx`, `AdminGuardLayout` redirect.
- `src/messages/{en,ar}.json`: `nav.myDay`, `nav.more`, `nav.bottomBar`, `myDay.*` (parity gate).
- No migration (D86). Put the day-start/count logic in one DAL fn `src/lib/my-day.ts` (server-only), not in the page.

## Steps (commit + push each)
1. (D86 row already written; no migration.) 2. `nav-model` MY_DAY/bottomBar + `role-home` + redirects + tests. 3. my-day page (RSC, queries, i18n). 4. Bottom bar + shell wiring. 5. Screenshots, PROGRESS.

## Tests (by name)
- `nav-model.test`: "agent home is My day", "bottom bar per role has <=4 items + More", "bottom bar never links an adminOnly page for agents (no Tasks)", "admin bar = Home/Confirmation/Orders/Money".
- `role-home.test`: "agent -> /app/my-day, admin -> /app/dashboard, none -> /login".
- `my-day.rls.test` (real sessions, D86): "agent confirms unassigned order -> confirmed +1", "second change same order same day adds no second order", "admin change on agent's order not counted", "order agent confirmed then admin assigned elsewhere not counted (limit pinned)", "delivery agent and other workspace get zero", "result has no money key".
- `my-day.render.test`: "renders four states, no links to tasks/meetings, no money".
- `mobile-bottom-bar.test`: "renders aria-current on active", "More opens drawer".

## Screenshots (light+dark, EN+AR RTL, 390 px; 1280 px shows no bar)
Admin bar on dashboard/orders; confirmation agent My day (populated + empty); delivery agent My day; More drawer open; page bottom not covered by bar; Arabic bar order mirrored.

## Edge cases
- Content hidden under fixed bar (`pb`), iOS safe area, in-app browsers; keyboard open must not float the bar over inputs (hide when a field is focused is optional).
- Active-leaf logic reuses longest-prefix match; "More" never shows active.
- Counter badge overflow ("99+") in 44 px slot; AR numerals via existing format helpers.
- No next meeting / no tasks -> empty states with no action link (agents cannot create).
