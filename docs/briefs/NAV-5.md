risk: high · surface: ui,security · lane: shell
(plan says L/no-migration; raised to high because "my numbers" for a confirmation agent needs a DB function — see Open question)

# NAV-5 — Mobile bottom bar + agent "My day" home

Goal: under 768 px every role gets a bottom bar (role's top destinations + More = existing drawer), and agents land on a read-only "My day" page instead of being bounced to their queue.

## Done when
- `<md`: fixed bottom bar, 44 px targets, safe-area padding, active state, counters; admin = Home · Confirmation · Orders · Money · More; confirmation agent = My day · Confirmation · More; delivery agent = My day · Shipping · More. `>=md`: no bar, sidebar unchanged.
- "More" opens the current drawer (`open` state in app-shell); the header hamburger is removed on mobile only if the bar replaces it (keep one way in, not two).
- Agent `/app/my-day`: queue count (same filter as layout counters), my open tasks (owner = me, read-only), next scheduled meeting (read-only), my numbers. No money, no cost fields.
- No link to a page RLS/guard refuses: spec's agent bar "Tasks" is NOT built (team/tasks is admin-guarded, nav `adminOnly`); tasks/meetings on My day are plain rows, no links.
- Agents land on My day after login and from `/app/orders`, `/app/dashboard` guard, not-found "back"; admin unchanged. Admin opening `/app/my-day` redirects to dashboard.
- Gate green; screenshots clean.

## Facts found in code
- `src/components/app-shell.tsx` (437 l): drawer state `open`, `inert` on content while open, `max-md:` classes; `nav-model.tsx`: `HOME` (adminOnly), `visibleNav(role)` gives agents `home:null` + one leaf; counters come from `app/(app)/app/layout.tsx` (confirmation/delivery/tasks, RLS-scoped).
- Landing today: `(app)/page.tsx` and `login/page.tsx` -> `/app/dashboard` -> `AdminGuardLayout` -> `/app/orders` -> role redirect (`orders/page.tsx`); `not-found.tsx` home = `/app/orders`; `requireAdmin` default `/app/dashboard`.
- RLS: `tasks_sel`/`m_sel` team-wide read (agents may read, writes admin). `orders` o_sel: confirmation agent sees only `confirmation_status <> 'confirmed'`; delivery agent only confirmed. `order_status_history` visible only with its parent order. `orders.assigned_confirmation_agent` / `assigned_delivery_agent` exist.
- So a confirmation agent CANNOT count "orders I confirmed today" with their session: confirmed orders leave their view. Delivery agent can (delivered stay visible). D64(5): "my numbers" must be an explicit "my orders" filter, labelled as such.
- Spec/table drift: spec bar lists "Tasks" for agents; stale (see above). "Home" for agent was meant as My day.

## Open question (needs a DECISIONS row before build — owner/`/decide`)
Confirmation-agent numbers: (a) new migration `00077_my_day_stats.sql`: `my_day_stats()` SECURITY DEFINER, `set search_path=public`, returns only counts for `auth.uid()` in `current_workspace_id()` (confirmed/cancelled/retry today from `order_status_history.actor = auth.uid()`, stage=confirmation), execute granted to authenticated only (revoke public/anon per 00076), no money, no rows of other users; or (b) no migration: show only queue + "handled today" for rows still visible, labelled honestly (undercounts confirmations). Recommend (a). Delivery agent uses plain RLS queries either way.

## Files
- `src/components/nav-model.tsx`: add `MY_DAY` leaf (`/app/my-day`, icon `Sun`/`CalendarCheck`), `home` for agents = MY_DAY, new `bottomBar(role): NavLeaf[]` (max 4 + More, derived from model, no hardcoded hrefs elsewhere).
- `src/components/mobile-bottom-bar.tsx` (new, client): `<nav aria-label>`, `<Link>`s, More = `<button>`; counters via `nav-counts.tsx`; logical props only, tokens only.
- `src/components/app-shell.tsx`: render bar `md:hidden`, `pb` on main for bar + `env(safe-area-inset-bottom)`, More opens drawer; focus returns to More on close.
- `src/app/(app)/app/my-day/{page,loading}.tsx` + `layout.tsx` (guard: admin -> `/app/dashboard`); page uses session client only; PageHeader with purpose line; four states.
- `src/lib/role-home.ts` (new): `roleHome(role)`; use in `login/page.tsx`, `orders/page.tsx`, `not-found.tsx`, `AdminGuardLayout` redirect.
- `src/messages/{en,ar}.json`: `nav.myDay`, `nav.more`, `nav.bottomBar`, `myDay.*` (parity gate).
- Migration (only if option a): skeleton per AGENTS.md checklist minus table items; add to `docs/DB.md`; regen types; RLS test with confirmation agent, delivery agent, anon, other-workspace.

## Steps (commit + push each)
1. Decision row + (a) migration, types, test. 2. `nav-model` MY_DAY/bottomBar + `role-home` + redirects + tests. 3. my-day page (RSC, queries, i18n). 4. Bottom bar + shell wiring. 5. Screenshots, PROGRESS.

## Tests (by name)
- `nav-model.test`: "agent home is My day", "bottom bar per role has <=4 items + More", "bottom bar never links an adminOnly page for agents", "admin bar = Home/Confirmation/Orders/Money".
- `role-home.test`: "agent -> /app/my-day, admin -> /app/dashboard, none -> /login".
- `my-day.rls.test` (if a): "confirmation agent gets own counts only", "agent cannot read another agent's counts", "anon cannot execute", "no money keys in result".
- `my-day.render.test`: "renders four states, no links to tasks/meetings, no money".
- `mobile-bottom-bar.test`: "renders aria-current on active", "More opens drawer".

## Screenshots (light+dark, EN+AR RTL, 390 px; 1280 px shows no bar)
Admin bar on dashboard/orders; confirmation agent My day (populated + empty); delivery agent My day; More drawer open; page bottom not covered by bar; Arabic bar order mirrored.

## Edge cases
- Content hidden under fixed bar (`pb`), iOS safe area, in-app browsers; keyboard open must not float the bar over inputs (hide when a field is focused is optional).
- Active-leaf logic reuses longest-prefix match; "More" never shows active.
- Counter badge overflow ("99+") in 44 px slot; AR numerals via existing format helpers.
- No next meeting / no tasks -> empty states with no action link (agents cannot create).
