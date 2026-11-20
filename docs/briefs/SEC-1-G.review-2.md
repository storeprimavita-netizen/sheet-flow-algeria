VERDICT: FIX

## Summary
The security core holds. Functions are invoker, keep their volatility and search_path, and only postgres and service_role can execute them. The live body matches 00072. A 270-case depth fuzz (62-66) and a 194-name unicode key fuzz found 0 SQL/TS mismatches and no idempotence failures. The backfill changes 0 rows and the 42501 tests are real. Full suite (987), tsc and i18n parity are green. Blocking: the committed screenshots (13d450a, 05:20) predate the review-1 M3/M4 fix (07b3f47, 06:44), so no committed image shows the fixed UI.

## Findings (ranked)

### M1 (medium): stale screenshots, review-1 M3/M4 never verified visually
- Where: `docs/design/audit/SEC-1-G/*.png`
- Failure:
  - `ar-light-390.png` still shows the clipped Action header ("الإج…"), the "TE" fragment, a table that scrolls sideways, and dotted keys.
  - `en-dark-390-empty.png` shows the old "No audit entries yet." with filters active, plus a Clear-all button the code no longer has.
  - There are no loading, error or AR empty-state shots.
- Live check: at 390 px, AR shows no horizontal scroll and the filtered empty title is correct. Only the committed evidence is wrong. Light theme and a live focused pill were not checked live.
- Fix:
  - Retake all 8 combos against the current code. Seed rows must include a pill, an empty key, a masked array, a colliding path, a long key and a short line.
  - Add focused-pill and filtered/unfiltered empty shots in EN+AR.
  - Verify pill contrast in light theme (>= 4.5:1).
  - Note the result in PROGRESS.md.

### L1 (low): DB.md line 36 contradicts itself
- Where: `docs/DB.md:36`
- Failure:
  - The new header describes the wider separator class, but the older text below it still lists only `-`/`.`/space/`:` as separators.
  - It also says only JSON null survives past depth 64.
  - It never mentions 00072 (`""` is kept at any depth).
  - The brief requires the parity claim to be true.
- Fix: rewrite the old part of the line and cite 00072.

### L2 (low): bad URL filters now send the page to error.tsx for good
- Where: `src/app/(app)/app/settings/audit/page.tsx:52`
- Failure: `?from=foo` or `?actor=x` raises a Postgres error (22007/22P02). The page throws, lands on `error.tsx`, and Retry fails forever. Before, it showed an empty list.
- Fix: zod-validate `from`/`to` as dates and `actor` as a uuid, and drop invalid values before the query.

### L3 (low): empty state has no action
- Where: `audit-table.tsx:71-73`
- Failure: brief item 6 asks for an empty-state action. Unfiltered, there is none. Filtered, the only way out is the filter bar's "Clear all".
- Fix: add a clear-filters action when filtered. When unfiltered, add a one-line description ("Changes to settings and finance appear here") or record the exception in the brief.

### L4 (low): error.tsx shows a generic message, not the reason
- Where: `src/app/(app)/app/settings/audit/error.tsx`
- Failure: the brief asks for a reason plus retry. Only `errorPage.body` and the digest are shown.
- Fix: show a mapped, i18n reason. The screen is admin-only, so this is safe.

### L5 (low): backfill test does not exercise the 00071 widening
- Where: `src/lib/audit-redact.rls.test.ts:164`
- Failure: the raw seed uses only `XAPIKey`, which has been masked since 00036.
- Fix: add a seed key that only the wider class catches, such as `api/key` or `secretkeys`.

### L6 (low): local migration history lacks 00072
- Failure: `schema_migrations` stops at 00071 because 00072 was applied by hand. The body is identical, so the tests are valid.
- Fix: run a local `npx supabase migration up` or `db reset` to prove the CLI path applies it.

### L7 (low): 390 px layout polish
- Where: `audit-table.tsx:44`
- Failure: the nowrap date takes about 45% of the width at 390 px, so long keys wrap tightly. In AR the date renders with the time first.
- Fix: below `sm`, stack the date under the table name and wrap it in `<bdi dir="ltr">`.
- Also: `zr_shipments` rows appear but are missing from the table filter list (`page.tsx:12-20`).

## Missing tests
- Render tests for `loading.tsx` and `error.tsx` (retry calls `unstable_retry`), and for `page.tsx` on a query error. Review-1 asked for these.
- A unicode-separator key list as a regression test (NBSP, ZWSP, combining marks, astral chars, fullwidth letters). Review-1 asked for this.
- `PARITY_CASES`: array-nested cap cases (`[[…""…]]` at depths 64-66) and `nest(65,"")`.
- Diff tests: object to array at the same path, a spoofed mask string in a non-secret field, and an empty-object leaf.
- Filtered vs unfiltered empty title, and an RTL render asserting `dir=ltr` and `<bdi>` isolation.
