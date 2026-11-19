VERDICT: FIX

## Summary
Reviewers: qa-reviewer (risk high) + ui-reviewer (surface ui, live, admin + agent, EN/AR, dark/light, 390 px).
Gate `--fast` green with the live RLS suite (601 passed); RLS, immutability trigger, 0-row checks, `.or()` sanitizing and fixed page filters hold. No data leak or privilege gain found.
Blocking: one medium. Users cannot create a view from Default, and confirmation/delivery have no filter UI, so views can only be created there by editing the URL by hand.
Several low DB-hardening and brief gaps, plus most page/UI tests named in the brief are missing.
Screenshots: docs/design/audit/CONF-1/ (19 captures).

## Findings (ranked)

1. **MEDIUM. Views cannot be created on confirmation or delivery, and not from Default anywhere.**
   - Files: `src/app/(app)/app/orders/saved-view-bar.tsx:52` (`dirty && view`), `all/page.tsx:164` (passes `dirty=false` when no view is active), `confirmation/page.tsx`, `delivery/page.tsx`, `view-tabs.tsx:97-121,160-161`.
   - Failure:
     - The Save-as bar only appears when a view is active and dirty.
     - Confirmation and delivery have no filter bar, so they never become dirty through the UI. The live review reached Modified only by adding `&q=Amina` to the URL.
     - Delivery has no seeds, and admins get no "Save as mine" on shared views.
     - So an admin can never create a view on confirmation or delivery, nobody can create one on delivery, and on all-orders a user has to start from a seed.
     - The "Save current filters as a view" hint is plain text and promises something these pages cannot do (screens `confirmation-admin-en-light-view-new.png`, `delivery-admin-en-light.png`).
   - Fix:
     - Add a "Save as view" action on Default and in the empty personal group that calls `createView` with the effective config. Offer Save-as-copy to admins on shared views too.
     - On confirmation/delivery, either add the minimal filter bar (`q` + status) or hide the hint and Save-as where there is no filter UI.
     - Make the hint an actionable button, or remove it when the Modified bar is already showing (duplicate call to action, `all-admin-en-dark-dirty.png`).

2. **LOW. The DB accepts padded names and arbitrary `seed_key`.**
   - File: `supabase/migrations/00056_order_views.sql:9`.
   - Failure:
     - As an agent (in a rolled-back transaction) this insert succeeded: name `'x'||repeat(' ',5000)` (stored length 5001), `seed_key='zzz'`, `position=-5`.
     - The `lower(name)` unique index does not trim, so "New" and "New " can both exist.
   - Fix: in a new migration, `check (name = btrim(name) and char_length(name) between 1 and 60)` and `check (seed_key is null or owner_id is null)`.

3. **LOW. The cap of 20 views is enforced only in the action.**
   - File: `views-actions.ts:56-60`.
   - Failure: a direct PostgREST insert bypasses the cap, and the action itself has a check-then-insert race.
   - Fix: a BEFORE INSERT trigger that counts rows per (workspace, scope, owner-kind), or document the gap in DB.md.

4. **LOW. `moveView` is not atomic.**
   - File: `views-actions.ts:128-132`.
   - Failure: it renumbers one row at a time, so concurrent moves interleave and a failure partway leaves positions half-renumbered.
   - Fix: swap only the two rows, or use one SECURITY INVOKER RPC.

5. **LOW. URL parsing is stricter than before and silently widens lists.**
   - File: `src/lib/order-views.ts:31`.
   - Failure:
     - A `q` longer than 80 characters now drops the whole filter (before, it was cut to 80). The command palette passes the raw query.
     - `confirmation_status=no_answer,bogus` now applies no status filter at all.
   - Fix: cut `q` to 80 before validating, and filter the status list one value at a time.

6. **LOW. Renaming a seed saves the translated label.**
   - File: `view-tabs.tsx:186`.
   - Failure: the rename dialog is pre-filled with the translated label, so an Arabic admin who only changes the emoji stores "جديد" as the name for every user.
   - Fix: pre-fill with `rename.name`, or skip the name when it is unchanged from the label.

7. **LOW. The clear-query link does nothing when `q` comes from the view.**
   - File: `all/page.tsx:149`.
   - Failure: the link deletes `q` from the URL but does not write `__all`, so the view's own `q` survives.
   - Fix: write `q=__all` when the active view has a `q`.

8. **LOW. An invalid `?view` is not stripped from the URL.**
   - File: `view-tabs.tsx:272`.
   - Failure: the notice shows, but `?view=x` stays in the URL and survives reloads until the user clicks Dismiss. The brief says to strip it.
   - Fix: redirect or `router.replace` on first render when the view is invalid.

9. **LOW. A duplicate-name error turns the submit button into "Retry".**
   - File: `view-name-dialog.tsx`.
   - Failure: "Retry" is the wrong label for a validation error (`all-admin-en-dark-saveas-duplicate-error.png`).
   - Fix: keep the button as "Save" and set `aria-invalid` plus an error description on the name field.

10. **LOW. Smaller gaps against the brief.**
    - Personal "Copy link" uses the saved config, not the effective one (`view-tabs.tsx:61`).
    - Delete uses a custom Dialog instead of `DeleteButton`.
    - There is no 3-pill Suspense skeleton for the strip; only the generic page skeleton shows.

## Missing tests (named in the brief)
- **RLS:**
  - The backfill seed is present for an **existing** workspace.
  - `seed_order_views` called twice as service role is idempotent (still 3 rows).
- **Unit:**
  - `resolveView` with a foreign private id, a view from another scope, and a deleted view. No test imports `resolveView`.
  - The seed test uses a copy of the seed configs rather than the migration's values.
- **Pages:**
  - "delivery filters confirmed whatever the view".
  - "agent opening admin `?view` on `all` sees only agent-visible orders".
- **UI:**
  - Keyboard path through the strip and menu, including Escape.
  - Agent sees no edit menu on shared views.
  - Focus moves to Default after deleting the active view.
  - The live review confirmed the last two by hand, but they are not automated.

## Screenshot coverage gaps
- Error state with Retry.
- Dedicated empty-personal state.
- Delivery as agent.
- Full Tab-key walk of the strip.

## Reviewer side effects (local only)
- The ui-reviewer restarted a hung dev server with `scripts/dev-up.sh`.
- It inserted 12 personal admin views (scope `all`) into the local DB to test overflow. They are still there.
