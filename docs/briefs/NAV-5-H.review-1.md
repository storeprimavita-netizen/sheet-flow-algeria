VERDICT: FIX

## Summary
Reviewers: qa-reviewer (owasp-security) and ui-reviewer, run on `git diff v3...v3-NAV-5-H`. The code is sound. No `getProfile())!` sites are left, no redirect cycle was found (2 hops at most, on full load and on in-app navigation), redirects have no open-redirect path, and `/no-access` leaks nothing (it shows only the user's own email). Touched tests pass (29 files, 136 tests). The UI renders correctly in EN and AR, dark and light, and at 390 px.
FIX because two deliverables named in the brief are missing: the live RLS test and the builder's screenshots plus PROGRESS note. Everything else found is low.
Note: the ui-reviewer's own screenshots were saved to `docs/design/audit/NAV-5-H/`, untracked. They were moved to `/tmp/NAV-5-H-ui-review/` so they would not count as the builder's deliverable.

## Findings (ranked)

1. **Medium: the live RLS test is missing.**
   - Where: `src/lib/rls.test.ts` (no case added).
   - Failure: brief line 51 requires a live (rls-style) test for three users: (a) no profile row, (b) `is_active=false`, (c) null workspace. Each must have `getProfile` null and see only their own profile row. Nothing in the diff covers this. Only the reviewer's manual, rolled-back query verified it: `current_workspace_id()` null, orders/settings/customers 0 rows, own profile 1 row.
   - Fix: add the three live cases. Assert `getProfile()` is null, `profiles` returns exactly the user's own row, and the business tables return 0 rows.

2. **Medium: the screenshot self-critique and the PROGRESS note were not delivered.**
   - Where: `docs/design/audit/NAV-5-H/` and `PROGRESS.md`.
   - Failure: the brief §Screenshots and AGENTS.md require, from the builder:
     - `/no-access` at 390 px and on desktop, in dark and light, EN and AR;
     - the sign-out pending and error states;
     - a keyboard pass;
     - light-mode muted-text contrast;
     - browser redirect checks.
     None of these are committed, and `PROGRESS.md` is unchanged.
   - Fix: finish step 5, commit the shots with `step.sh`, and add the PROGRESS note.

3. **Low: the sign-out error renders inside the shell's dropdown.**
   - Where: `src/components/app-shell.tsx:402-404` and `src/components/sign-out-button.tsx:56`.
   - Failure: `<p role="alert">` sits inside `role="menu"`, which is invalid ARIA. The message also unmounts when the menu closes. `DropdownMenuItem asChild` props were already dropped on v3, because the component only takes `className`/`size`.
   - Fix: forward the rest props to the `<button>`, and surface the error through a toast in the shell context.

4. **Low: the button can be clicked twice after a successful sign-out.**
   - Where: `src/components/sign-out-button.tsx:39`.
   - Failure: `busy` is reset to false on success, before navigation to `/login` completes, so the button becomes clickable again.
   - Fix: reset `busy` only on the failure path.

5. **Low: the sign-out icon does not mirror in RTL.**
   - Where: the `LogOut` icon in `src/components/sign-out-button.tsx`.
   - Failure: the exit arrow points the wrong way in AR.
   - Fix: add `rtl:-scale-x-100`.

6. **Low: the `signOutFailed` alert is start-aligned.**
   - Where: `src/components/sign-out-button.tsx`, the `signOutFailed` paragraph.
   - Failure: everything else in the `/no-access` card is centered, so the alert stands out. In AR it also wraps with a lone last word.
   - Fix: add `text-center`, or let the caller pass alignment.

7. **Low: the LocaleSwitcher is not placed top-end and its tap target is small.**
   - Where: `src/app/(app)/no-access/page.tsx:31-33`.
   - Failure: the brief says top-end, but it renders centered above the icon. Its tap height is 32 px at 390 px.
   - Fix: wrap it in `flex justify-end` and give it `min-h-11`.

8. **Low: three tests check less than their names claim.**
   - `src/components/admin-guard-layout.test.tsx:26` asserts only `NEXT_REDIRECT`. It checks neither the `/no-access` target nor that `requireAdmin` was not called.
   - `no-access.page.test.tsx`, "no self-redirect", repeats the null render. It never exercises a profile whose `roleHome` is `/no-access` (an unknown role cast at `rbac.ts:33`).
   - `null-profile.cycle.test.tsx:81`, "/app/dashboard section guard", reassigns the same handler and proves nothing new.
   - Fix: assert the redirect target and the not-called spy, and add the unknown-role case.

9. **Low (owner preference, no action required): `/no-access` has no theme toggle.** The stored theme class applies, and light mode matched the tokens.

## Missing tests
- The live RLS test for users a, b and c (finding 1).
- In the cycle test, these brief items are absent:
  - the GroupHub `notFound()` path, i.e. not-found link → `/no-access`;
  - `[...rest]`;
  - a signed-in null-profile user on `/login`.
- Client navigation through `getProfile` itself. `sell/null-profile.test.tsx` mocks `requireProfile`, so the real path is not exercised.
- `rbac.test.ts` "null for query error" should return `{ data: null, error }`, Supabase's real error shape, not `data: undefined`.
- `sign-out-button.test.tsx`: assert that `aria-busy` is set while busy and cleared after a failure.
- `/no-access` renders without AppShell and runs no workspace query (beyond the `from` spy).
