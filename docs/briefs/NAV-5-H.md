risk: high · surface: ui,security · lane: shell
(plan row NAV-5-H; D87 (7), D88; no migration, no policy, no service role, no new DECISIONS row)

# NAV-5-H — no-access page for a signed-in user with no profile

Goal: a signed-in user whose `getProfile()` is null (no profile row, inactive, no workspace) lands on a
`/no-access` page with the reason and sign-out, in one hop, instead of looping.

## Definition of done
- Loop confirmed in code: `/` -> `/app/dashboard` -> `AdminGuardLayout` -> `/app/orders` -> `/app/sell/orders`
  -> `AdminGuardLayout` -> `/app/orders` ... ; `roleHome(null)="/login"` bounces back (proxy, `session.ts:50`).
- Null profile on any `/app/**` route, `/`, or `/login` reaches `/no-access` in at most 2 hops, never cycles.
- `/no-access` sits OUTSIDE `src/app/(app)/app/` (so outside `AppLayout`/AppShell and every guard), shows no
  workspace data (no counts queries, no nav), only title, reason, sign-out.
- Signed-out visitor to `/no-access` -> `/login`. A user WITH a profile visiting it -> `roleHome(role)`.
- No test deleted; the two `null` expectations are changed to the new target (ordered by D88 (4)).

## Files
- `src/app/(app)/no-access/page.tsx` (new, server): `getUser()` null -> redirect `/login`; `getProfile()` truthy ->
  redirect `roleHome(role)`; else render centered card (Lucide `ShieldOff`, `h1`, body, `SignOutButton`).
  `generateMetadata` from `noAccess` messages. Semantic tokens only (App design system), dark default.
- `src/components/sign-out-button.tsx`: move from `app/(app)/app/dashboard/sign-out-button.tsx` (git mv) and
  fix import in `src/components/app-shell.tsx:14`. It uses `common.signOut` and `router.replace("/login")`;
  signOut clears the cookie so the proxy no longer bounces `/login`.
- `src/app/(app)/app/layout.tsx`: after `getUser()`, `const profile = await getProfile(); if (!profile)
  redirect("/no-access")` BEFORE the counts queries. This is the single choke point for every `/app/**` null
  case (covers `AdminGuardLayout`, `orders/page.tsx`, `my-day/layout.tsx`, `[...rest]`, not-found). Layouts
  still render in parallel with pages in Next, so keep the guard pages' null branches pointing to
  `/no-access` too (defense in depth, no residual cycle):
  - `src/components/admin-guard-layout.tsx`: null profile -> `/no-access` (was `/app/orders`).
  - `src/app/(app)/app/orders/page.tsx`: null -> `/no-access`.
  - `src/app/(app)/app/my-day/layout.tsx`: null role -> `/no-access`; admin -> dashboard unchanged.
  - `src/app/(app)/page.tsx`: null -> `/no-access` (was `/app/dashboard`).
  - `src/app/(app)/app/not-found.tsx` and `[...rest]/page.tsx`: check for the `/app/orders` fallback; point null to `/no-access`.
- `src/lib/role-home.ts`: `roleHome(null)` -> `/no-access` (update its doc comment and `role-home.test.ts`).
  Simplest: callers then need no special-casing.
- `src/proxy`/`session.ts`: leave unchanged (matcher already covers `/no-access`; it only gates `/app` and `/login`).
  A signed-in null user hitting `/login` goes `/app/dashboard` -> `/no-access`: 2 hops, acceptable.
- `src/messages/{en,ar}.json`: `noAccess.{title,body,hint}` (reason: not yet added to a workspace, or account
  deactivated; ask an admin). Key parity is gated.

## Steps (each committed with scripts/step.sh)
1. Move SignOutButton to `components/`, fix import.
2. `roleHome(null)`, guard redirects, `(app)/page.tsx`, `AppLayout` guard + updated tests.
3. `/no-access` page + messages EN/AR.
4. Tests, screenshots, gate.

## Acceptance tests (by name)
- `no-access.page.test.tsx`: "signed out redirects to /login"; "profile present redirects to role home";
  "null profile renders reason and sign-out, no workspace query".
- `app.layout.test.tsx`: "null profile (no row)", "inactive profile", "no workspace" each redirect `/no-access`
  before any `orders`/`tasks` query (mock `getProfile` null, assert `createClient().from` not called).
- `root-page.test.ts`: null -> `/no-access`. `my-day.layout.test`: "no role goes to /no-access, not itself".
- `admin-guard-layout.test`: null -> `/no-access`; agent -> `/app/my-day`. `orders-page`: null -> `/no-access`.
- Cycle test: follow redirects of each guard for null profile with mocks; the chain ends at `/no-access`
  within 2 steps and `/no-access` itself never redirects for null.
- Live (rls-style, local stack): create users with (a) no profile row, (b) `is_active=false`, (c)
  `workspace_id` null; `getProfile` returns null for each and the profile query returns only own row.

## Screenshots (ui)
`/no-access` at 390 px and desktop, dark + light, EN + AR (RTL); sign-out works and lands on `/login`.

## Edge cases / assumptions
- Confirmed in code (not reproduced in a browser yet): loop above; `grep no-access src` empty.
- Layout/page redirects in Next 16 App Router: read `node_modules/next/dist/docs/` on `redirect` before coding.
- `getProfile` swallows query errors as null: a transient DB error would show "no access". Acceptable now;
  page copy says "try again or contact an admin", with a reload link-free hint. Do not change `getProfile`.
- No-access page must not render `AppShell` nor call `getStatusLabelOverrides` (workspace data).
- Review: `qa-reviewer` (auth redirects, no data leak) + `ui-reviewer`.
