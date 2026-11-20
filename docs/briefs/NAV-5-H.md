risk: high · surface: ui,security · lane: shell · D87 (7), D88; no migration/DECISIONS row; revised after review-0

# NAV-5-H — no-access page for a signed-in user with no profile
Goal: a signed-in user whose `getProfile()` is null (no row, inactive, no workspace) reaches `/no-access`
(reason, retry, sign-out) in <= 2 hops, on full load AND in-app navigation, never cycling.
## Definition of done
- Loop in code: `/`->`/app/dashboard`->`AdminGuardLayout`->`/app/orders`->`/app/sell/orders`->guard->... ;
  `roleHome(null)="/login"` bounces back (proxy, `session.ts:50`). No cycle remains.
- `/no-access` sits OUTSIDE `src/app/(app)/app/` (no AppShell/guards/workspace queries): title, reason, email, retry, sign-out.
- Signed-out -> `/login`; profile present -> `roleHome(role)` unless that equals `/no-access` (no self-redirect).
- Deactivated while a tab is open: clicking an order/customer goes to `/no-access`, not `error.tsx`.
- Four expectations changed (D88 (4)): `root-page.test.ts:21`, `my-day.layout.test.tsx:29-32` (renamed),
  `role-home.test.ts:10`, `not-found.test.tsx:32-35`. No test deleted.
## Files
- `src/lib/rbac.ts`: add `requireProfile(): Promise<Profile>` (null -> `redirect("/no-access")`). Replace
  `(await getProfile())!` with it in `sell/orders/[id]/page.tsx:68`, `sell/customers/[id]/page.tsx:42`, and every
  other non-null site without a guard above (grep `getProfile())!`; dashboard/statistics/settings/products too).
  Do not change `getProfile`.
- `src/app/(app)/no-access/page.tsx` (new, server): `getUser()` null -> `/login`; profile and
  `roleHome(role)!=="/no-access"` -> redirect there; else render. Mirror `/login`: `<main>` >
  `flex min-h-screen items-center justify-center p-4` > `card-surface w-full max-w-md rounded-2xl p-8`; `LocaleSwitcher`
  top-end; ShieldOff (aria-hidden) on muted/warning token tile, not `bg-primary`; one `h1`; body; user email in
  `<bdi dir="ltr">`; actions: "Try again" (link to `/`, re-evaluates) + SignOutButton. No `Empty`/`PageHeader`.
- `src/components/sign-out-button.tsx`: `git mv` from `app/dashboard/`, fix import `app-shell.tsx:14`. Add
  `size` prop (no-access uses `lg`/min-h 44px at 390 px), busy state (disabled + `aria-busy`), try/finally,
  catch/`error` from `signOut()` -> inline `role="alert"` `common.signOutFailed` and stay on page.
- `src/app/(app)/app/layout.tsx`: `getUser()` then `getProfile()`; null -> `/no-access` BEFORE counts queries and
  `getStatusLabelOverrides` (defense in depth only; not run on client navigation).
- Null branches -> `/no-access`: `admin-guard-layout.tsx`, `orders/page.tsx`, `my-day/layout.tsx`, `(app)/page.tsx`
  (check `getUser()` first: null -> `/login`), `app/not-found.tsx` and `[...rest]/page.tsx` (check `/app/orders` fallback).
  `requireAdmin("/app/orders")` callers (`sell/orders/new:10`, `catalog/pricing:15`, `products/[id]/pricing:12`)
  take 2 hops once `orders/page.tsx` is fixed; leave, cover in cycle test.
- `src/lib/role-home.ts` + test: `roleHome(null)` -> `/no-access`. proxy/`session.ts` unchanged.
- `src/messages/{en,ar}.json` (parity gated): `noAccess.{title,body,hint,retry,account}`, `common.signOutFailed`.
  EN: "No access yet" / "Your account isn't active in a workspace. It may be new or deactivated." / "Ask an admin, then try again."
  AR: native phrasing, e.g. "لا يوجد وصول" / "حسابك غير مفعّل في أي مساحة عمل حاليًا." / "تواصل مع المسؤول ثم أعد المحاولة."
## Steps (scripts/step.sh each)
1. Move/upgrade SignOutButton (+ message key). 2. `requireProfile` + call sites + `rbac.test.ts`.
3. `roleHome(null)`, guard redirects, root page, AppLayout guard, 4 test updates. 4. `/no-access` page + messages.
5. Cycle/page tests, screenshots, gate.
## Acceptance tests (by name)
- `rbac.test.ts`: getProfile null for "no row", "inactive", "no workspace", "query error"; profile for active row;
  `requireProfile` redirects `/no-access`.
- `no-access.page.test.tsx`: "signed out redirects to /login"; "profile redirects to role home"; "null renders reason,
  retry, sign-out, no workspace query"; "no self-redirect".
- `app.layout.test.tsx`: "no row", "inactive", "no workspace" -> `/no-access`; `from` and `getStatusLabelOverrides` not called.
- `sell-orders-id` / `sell-customers-id`: null profile -> `/no-access`. `root-page`: "signed out -> /login", "null -> /no-access".
- `sign-out-button.test.tsx`: failure shows alert, no navigation; busy disables.
- Cycle test (mocks): null profile on `/`, `/login`, `/app/dashboard`, `/app/orders`, `/app/my-day`, `sell/orders/new`,
  catalog pricing x2, GroupHub `notFound()`, not-found link ends at `/no-access` in <= 2 hops; `/no-access` never redirects for null.
- Live (rls-style): users (a) no row (b) `is_active=false` (c) null workspace; getProfile null, only own profile row visible.
## Screenshots (ui) -> `docs/design/audit/NAV-5-H/`
`/no-access` 390 px + desktop, dark+light, EN+AR (RTL); sign-out pending and error states; keyboard pass; light muted-text
contrast; browser checks: signed out -> `/login`, profile -> role home, sign-out lands `/login`.
## Edge cases / assumptions
- Confirmed in code: loop; `grep no-access src` empty. Layouts don't re-render on in-app navigation
  (`node_modules/next/dist/docs/01-app/02-guides/authentication.md`), hence `requireProfile`. Read the `redirect` doc first.
- `getProfile` turns a DB error into null: "no access" may be transient; "Try again" is the recovery. Accepted.
- Review: `qa-reviewer` + `ui-reviewer`.
