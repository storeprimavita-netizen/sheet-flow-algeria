risk: low · surface: ui,security · lane: shell

# NAV-5-I — close NAV-5-H review-2 lows

Goal: make the no-access RLS check real, record the missing keyboard pass, and add the missing tests named in `docs/briefs/NAV-5-H.review-2.md` (findings 1, 3, 4, 6, 7 + "Missing tests"). No product behaviour change.

## Done when
- [ ] `src/lib/rls.test.ts` ~l.553: every BUSINESS table is queried with an existing column (or `{count:"exact",head:true}`) and `error` is asserted null, then count/rows 0. Proof: temporarily select `nonexistent` and see the test fail (do not commit that).
- [ ] `/no-access` keyboard pass done in EN and AR (Tab order: language switcher, Retry, Sign out; visible focus ring; Enter/Space activates) and noted in PROGRESS.md.
- [ ] `errorAs="toast"` has a test: `toast.error` called with `signOutFailed`, no inline `role="alert"`, busy cleared after failure; `errorAs="inline"` shows the alert instead.
- [ ] Cycle-test gaps closed; the no-op step (review finding 4) removed or made meaningful.
- [ ] Local user `noaccess-shots@seed.mnw` deleted from local `auth.users` (local stack only).
- [ ] `scripts/gate.sh` green.

## Files
1. `src/lib/rls.test.ts` (l.506 BUSINESS, l.553 loop): fix `settings` (PK `workspace_id,key`, no `id`). Simplest: `.select("*", {count:"exact", head:true})`, assert `error` null and `count === 0` for all four.
2. `src/components/sign-out-button.test.tsx` (new). No jsdom/testing-library exists and none may be added (unplanned dependency). Pattern: like `no-access.page.test.tsx`, mock `react` `useState` with captured setters (or a tiny hook harness), mock `sonner`, `next/navigation`, `next-intl`, `@/lib/supabase/client` (`auth.signOut` resolves `{error}`); call `SignOutButton(props)`, find the Button element in the returned tree, invoke its `onClick`, assert on toast/state. Assert `aria-busy` true while pending, false after failure.
3. `src/app/(app)/no-access/no-access.page.test.tsx`: replace the duplicate "no self-redirect" case (l.~54) with a profile whose role is unrecognised (mock `roleHome` result `/no-access` via an unknown role); assert it renders, no redirect.
4. `src/app/(app)/no-access/null-profile.cycle.test.tsx`: add `[...rest]` (catch-all not-found page under `src/app`, find the real file) and `/login` for a signed-in null-profile user (proxy -> `/app/dashboard` -> AppLayout -> `/no-access`, 2 hops; read `src/proxy.ts` for the redirect, model it as a step). Drop the reassigned-handler test at l.~72 (or make it exercise a different guard).
5. `src/app/(app)/app/sell/null-profile.test.tsx`: add one case that does NOT mock `requireProfile`, mocking only the supabase client, so the real `getProfile` -> `requireProfile` path runs on a detail page.
6. `src/lib/rbac.test.ts`: the query-error case already exists (l.39); nothing to add (stale item in review).
7. PROGRESS.md: keyboard-pass note plus the two review-listed browser checks (profile present lands on role home; sign-out lands on `/login`).

## Steps (each committed with scripts/step.sh)
1. RLS check fix (+ fail-proof run). 2. sign-out-button test. 3. no-access page + cycle test additions. 4. sell null-profile real-path test. 5. Browser: keyboard pass EN+AR, role-home and sign-out checks, delete the local screenshot user, PROGRESS note.

## Tests by name
`rls.test.ts` "own profile only, zero business rows" (strengthened); `sign-out-button.test.tsx` "toast mode: toasts, no inline alert, clears busy", "inline mode: shows alert"; no-access "unknown role renders without redirect"; cycle "[...rest]" and "/login signed-in null profile <= 2 hops"; sell "real getProfile redirects to /no-access".

## Screens (ui)
`/no-access` EN + AR keyboard walk, dark and light (focus ring visible). Use chrome-devtools; if unavailable, say so.

## Edge cases / assumptions
- Review findings 2 (copied predicate) accepted as is. Finding 5 (My day / Team rules blank for deactivated user) is optional and NOT in scope; add `requireProfile()` only if trivial, else leave.
- rbac query-error test is already present (stale in review).
- No migration, no new DECISIONS row needed. Low risk: tests and docs only; `surface security` because it touches the RLS suite.
