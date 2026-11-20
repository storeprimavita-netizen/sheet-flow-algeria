VERDICT: ESCALATE

## Summary
The security core passes: live SQL and TS give the same output (4000-name fuzz and 180 deep-nesting cases, 0 mismatches), redaction is idempotent, no plaintext leaks, grants and invoker are correct, the backfill is sound and the 42501/xmin tests are valid.
The UI still has two medium findings. One is a brief deliverable that is missing: the focused-pill screenshot is byte-identical to the unfocused one.
This is review 3 without a PASS, so the loop rule escalates it. The owner decides whether to accept the UI mediums as follow-ups or to run one more FIX round.

## Findings (ranked)

1. **MEDIUM, ui: docs/design/audit/SEC-1-G/en-dark-390-focused-pill.png.**
   - Failure: `cmp` against `en-dark-390.png` reports IDENTICAL, so the focus shot the brief requires does not exist.
   - The pill (`audit-table.tsx:24-30`) is a tab stop (`tabIndex=0`) with no `focus-visible` class, and the app has no global focus rule. Visible focus (WCAG 2.4.7) depends on the browser default and has not been verified.
   - Pill contrast (`text-muted-foreground` on `bg-secondary`, >= 4.5:1 in both themes, per brief §6) is not measured or recorded.
   - Fix: add `focus-visible:ring-2 focus-visible:ring-ring` to the pill, retake a real focused shot, and record the contrast ratio for both themes in PROGRESS.

2. **MEDIUM, ui: `_lib/diff.ts:56` with `audit-table.tsx:41`.** Colliding paths render the same text on screen.
   - Failure: `{"a.b":1}` and `{a:{b:1}}` both display as `a.b`. en-light-1440 shows "a.b: 1 → 3" and "a.b: 1 → 2", which a reader cannot tell apart.
   - The array index `items › 0` also looks like an object key named "0", and a key that contains " › " collides the same way.
   - The ids are distinct, so React is fine, but the brief's own seed case is unreadable.
   - Fix: give the display key distinct segments, e.g. quote keys that contain `.` or ` › ` and show indices as `[0]`.

3. **LOW, ui: 390 px screenshots.** They start at the table card, so the page header, tabs and filter bar at 390 px are not shown. Fix: retake full-page.

4. **LOW, ui: `audit-table.tsx:41`.** The AR empty-key label `(مفتاح فارغ)` sits inside `<li dir="ltr">`, so its parentheses look mirrored in ar-light-390. Fix: wrap the i18n label in `<bdi dir="rtl">`.

5. **LOW, `page.tsx:12` (DATE).** `Date.parse("2026-02-31")` accepts the date, then Postgres rejects it and the error page shows. This contradicts "Invalid URL values are dropped". Fix: refine with a round-trip `toISOString().slice(0,10) === s`.

6. **LOW, `page.tsx:15` (AUDITED_TABLES).** The enum is a subset of the tables that have the trigger. `cash_collections`, `stores`, `store_pages`, `product_pricing`, `accounts`, `reviews` and others are missing, so `?table=stores` is silently dropped. Fix: list every table that has `audit_row`.

7. **LOW, `audit-redact.rls.test.ts` backfill test.**
   - The full-table UPDATE (about 167k rows, about 22 s) holds row locks while other test files run in parallel, which can block or flake.
   - It hardcodes `docker exec` and fails instead of skipping when the container is absent.
   - Fix: add `SET lock_timeout` and skip when the container is missing.

8. **LOW, `audit-table.tsx:58-61`.** The responsive classes go through the column `width` prop. Fix: add a `className`/`hideBelow` option to the data-table.

9. **LOW, `page.tsx`.** The `to` filter `${to}T23:59:59` has no timezone, so the cutoff uses the DB timezone.

## Missing tests
- 42501 for the 1-arg `audit_redact(j)` as agent and anon. The old weak check was removed and nothing covers this overload now. It is correct live.
- PARITY_CASES for a token with a trailing newline and an uppercase-hex fake token under a secret key, to pin the regex anchoring.
- Page URL validation: `from=2026-02-31`, a non-uuid `actor` and an unknown `table` are dropped.
- Render tests for the empty and filtered-empty states (Clear action) and for loading.tsx / error.tsx (retry calls `unstable_retry`).
- Render test that colliding display keys stay distinguishable (finding 2).
- Pill contrast measurement in both themes.

## Owner decision needed
Accept findings 1 and 2 as a follow-up UI task and ship the security fix now (recommended: the redaction core is verified), or order a fourth FIX round on this branch.
