VERDICT: FIX
## Summary
Brief review (qa-reviewer + ui-reviewer, no code yet). The design ends the full-load loop for a null-profile user: `/`, `/login`, and `/app/**` reach `/no-access` in 2 hops or fewer. There is no open redirect and no data leak; a live RLS check showed a deactivated user sees 0 orders and 0 tasks and only their own profile. No owner decision is needed.
Two medium gaps block build. Client-side navigation skips the `AppLayout` guard and lands a deactivated user on an error page. `/no-access` also has no recovery path when sign-out or the profile query fails.
Fix the brief, then build.

## Findings (ranked)

1. **Medium: the `AppLayout` choke point does not cover client-side navigation.** `src/app/(app)/app/sell/orders/[id]/page.tsx:68` (`(await getProfile())!`) and `src/app/(app)/app/sell/customers/[id]/page.tsx:42`.
   - Next does not re-render a shared layout on in-app navigation (`node_modules/next/dist/docs/01-app/02-guides/authentication.md:1350`). `error.tsx` retry also re-fetches only below the layout.
   - Failure: a user is deactivated while their tab is open, then clicks an order. The page throws a TypeError, `error.tsx` shows, and retry throws again. This is the exact "inactive" case the task targets.
   - Fix: add `requireProfile()` in `src/lib/rbac.ts` that redirects to `/no-access`. Use it at the non-null `getProfile()` call sites that have no `AdminGuardLayout` above them (at least these two; grep `getProfile())!`). Add the brief's claim "single choke point" only as defense in depth.

2. **Medium: `/no-access` has no recovery path; error and pending states are missing (four-states rule).** The button to be moved, `src/app/(app)/app/dashboard/sign-out-button.tsx`, ignores the `signOut()` error and has no busy state.
   - Failure: if `signOut()` fails, the session survives and the user loops `/login` -> `/app/dashboard` -> `/no-access` with no feedback.
   - Failure: `getProfile` turns a transient DB error into null, which shows "no access" with no retry. "Reload link-free hint" is not a retry.
   - Fix, sign-out: in the shared `SignOutButton`, add a busy state (disabled + `aria-busy`), use try/finally, and show an inline `role="alert"` error with retry (key under `common`).
   - Fix, recovery: add a "Try again" action (a link to `/` or `router.refresh`) next to Sign out. It re-evaluates and redirects home once the profile is back.

3. **Low: there is no language switcher on a dead-end page.** Add `LocaleSwitcher` as `/login` does (`src/app/(app)/login/page.tsx:46`); it reads no workspace data.

4. **Low: the layout should mirror `/login`.**
   - Use the same structure: `flex min-h-screen items-center justify-center p-4` > `card-surface w-full max-w-md rounded-2xl p-8`.
   - Do not use `Empty` or `PageHeader`.
   - Show ShieldOff on a muted or warning token tile (not `bg-primary`) with `aria-hidden`.
   - Use a single `<h1>` (the page title, not the brand) inside a `<main>` landmark.
   - The button must be at least 44 px tall at 390 px: the current `size="sm" w-full` is sidebar sizing, so pass a size prop.

5. **Low: `requireAdmin("/app/orders")` is missed in 3 places:** `sell/orders/new/page.tsx:10`, `catalog/pricing/page.tsx:15`, `catalog/products/[id]/pricing/page.tsx:12`. They take 2 hops once `orders/page.tsx` is fixed, so there is no cycle. Add them to the cycle test.

6. **Low: test-change accounting.** Four expectations change, not two: `root-page.test.ts:21`, `my-day.layout.test.tsx:29-32`, `role-home.test.ts:10`, and `not-found.test.tsx:32-35`. List all four, and state that the my-day test is renamed under D88 (4).

7. **Low: a signed-out visitor to `/` now goes `/no-access` -> `/login`.** In `src/app/(app)/page.tsx`, check `getUser()` first and send null to `/login`.

8. **Low: `/no-access` could redirect to itself.** It does so if `roleHome(role)` ever returned `/no-access` for a non-null role (`getProfile` casts `as Role` without checking, `rbac.ts:33`). Redirect only when the target is not `/no-access`.

9. **Low: copy.** Define EN/AR `noAccess.{title,body,hint}` and the retry and error strings in the brief. Arabic must be native, not a word-for-word translation. Optionally show the signed-in email (the user's own, `dir="ltr"`/`<bdi>`) so they know which account they are on.

## Missing tests
- `rbac.test.ts` for `getProfile`: null for no row, `is_active=false`, `workspace_id` null, and query error; the profile for an active row. Without it, the three `app.layout` cases are one mock repeated.
- `app.layout.test`: also assert that `getStatusLabelOverrides` is not called.
- A null profile on `sell/orders/[id]` and `sell/customers/[id]` redirects to `/no-access` (finding 1).
- Cycle test: add the 3 `requireAdmin("/app/orders")` pages, the `GroupHub` `notFound()` path, the not-found link target, and signed-in null on `/login` -> `/app/dashboard` -> `/no-access`.
- Root page: a signed-out visitor goes to `/login`.
- `SignOutButton`: when `signOut` fails, it shows the error and stays on the page.
- Screenshots: add the sign-out pending and error states, a keyboard pass, and light-theme muted-text contrast. Run the redirect hops (signed out -> `/login`; profile -> role home) as browser checks. Save them under `docs/design/audit/NAV-5-H/`.
