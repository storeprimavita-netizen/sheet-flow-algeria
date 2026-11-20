VERDICT: PASS

## Summary
Round 2 on `git diff v3...v3-NAV-5-H`, reviewed by qa-reviewer (with owasp-security) and ui-reviewer.
All 8 review-1 findings are resolved; #8 (test strength) is only partly done, and what is left is low.
qa ran the touched unit tests (291 passed, 2 skipped) and `tsc` (clean). The live RLS suite passed 56/56, including the 3 new NAV-5-H cases. A rolled-back SQL check with a deactivated agent returned 0 business rows; the agent can see only its own profile row, and `guard_profiles` blocks self-reactivation.
No open redirect (all targets are constants), no service-role client, and no `getProfile())!` site left.
No high or medium findings. ui-reviewer judged from code plus 3 of the 9 committed screenshots and did not drive the browser itself.

## Findings (ranked)

1. **Low: one RLS assertion passes without testing anything.** `src/lib/rls.test.ts:554` runs `from(table).select("id")` over `["orders","customers","products","settings"]`. `settings` has no `id` column (PK `workspace_id, key`, `00002_settings.sql:38-44`), so PostgREST returns an error and `data` is null. `data ?? []` is then empty and the check passes, so a real settings leak would go unseen. (A SQL check confirms 0 rows today.)
   Fix: select an existing column, or use `{ count: "exact", head: true }`, and assert `error` is null for every table.
2. **Low: the live test copies the `getProfile` predicate instead of calling it.** `src/lib/rls.test.ts:546-552`. It will not catch a change inside `getProfile`. Acceptable as is.
3. **Low: "no self-redirect" test is a duplicate.** `src/app/(app)/no-access/no-access.page.test.tsx:54` repeats the null-profile case. It never uses a profile whose `roleHome` is `/no-access` (unknown role), so the guard at `src/app/(app)/no-access/page.tsx:27-28` is untested.
   Fix: add a case with an unrecognised role and assert the page renders with no redirect.
4. **Low: one cycle-test step adds nothing.** `src/app/(app)/no-access/null-profile.cycle.test.tsx` reassigns the same handler, which proves nothing new.
5. **Low: My day and Team rules render blank instead of sending a deactivated user to `/no-access`.** On in-app navigation, `src/app/(app)/app/my-day/page.tsx:17` returns `null` and `team/rules/page.tsx` renders empty. Nothing leaks because RLS returns 0 rows, and the brief does not require this.
   Optional fix: call `requireProfile()` in both.
6. **Low: some browser checks are not recorded.** PROGRESS notes that the keyboard pass was not done. The checks "profile present lands on role home" and "sign-out lands on /login" are not recorded. The local-only screenshot user `noaccess-shots@seed.mnw` is still in `auth.users`.
7. **Low: toast error path has no test.** `src/components/sign-out-button.tsx:40` (`errorAs="toast"`) has no test asserting that `aria-busy` is set while busy and cleared after a failure.

## Missing tests
- Cycle test: `[...rest]`, and a signed-in null-profile user on `/login` (proxy -> `/app/dashboard` -> AppLayout -> `/no-access`, 2 hops).
- `src/app/(app)/app/sell/null-profile.test.tsx` mocks `requireProfile`, so the real `getProfile` -> `requireProfile` path on the detail pages is never run.
- `/no-access` with an unknown role (finding 3).
- `rbac.test.ts`: a query error (`{ data: null, error }`) gives a null profile and a redirect.
