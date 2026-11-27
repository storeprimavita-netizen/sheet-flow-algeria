VERDICT: FIX

## Summary
Round 1, `git diff v3...v3-CHART-1-B`, ui-reviewer. The new far-future live test fails, so the live suite is red (1 high).
One pre-existing medium: the Revenue link on Money overview is malformed. Done-when 3 and 4 hold on screen.
Done-when 1 and 2 are correct by code reading; the live proof of the cap is broken. Not every theme/locale/width was looked at.

## Findings
1. **HIGH** (introduced) `src/lib/chart-series.rls.test.ts:196-200`.
   Failure: with `LOCAL_SUPABASE_URL` set (as `scripts/gate.sh` sets it) the test fails every run: expected `2099-06-01`, got `2099-06-30` (15 passed, 1 failed; re-run by the router). It also does not test the cap: `p_to: "2099-06-30"` makes SQL itself return 366 rows, so it would pass the length check without `.order().limit()`.
   Fix: call with `{ p_from: FROM }` only (no `p_to`), same order, limit and expectations; run the full gate with the live suite.
2. **MEDIUM** (pre-existing) `src/app/(app)/app/money/overview/page.tsx:128`.
   Failure: `?tab=income${qs({})}` renders `?tab=income?from=...` (or `?tab=income?`), because `financeQs` starts with `?`. `tab` is then not `income`, so Revenue opens the Collections tab and the period is lost.
   Fix: `/app/money/courier-cash${qs({ tab: "income" })}`.
3. **LOW** (introduced, follows the brief's class list) `src/components/charts/chart-panel.tsx:105`.
   Table row links look like plain text on touch (underline on hover only). Fix: persistent underline or primary text colour.
4. **LOW** (pre-existing) `src/components/charts/chart-panel.tsx:91,113`.
   RTL: Amount and Share headers sit left while their `dir="ltr"` values sit right. Fix: put `dir="ltr"` on an inner `<bdi>`, not on the cell.
5. **LOW** (process) `docs/design/audit/CHART-1-B/`.
   6 shots (EN dark 1280, AR light 390), not the brief's matrix; empty state only in EN dark 1280.

## Missing tests
- A working live far-future test (finding 1).
- A rendered test of the all-zero Finance empty state (the current one and the cap guard only match source strings).
