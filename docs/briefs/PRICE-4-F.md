# PRICE-4-F brief
risk: low · surface: ui · lane: catalog
(csv.ts is shared with the orders export; no RLS, auth, money formula or migration. Run the gate and qa-reviewer only if csv.ts quoting changes, see step 1.)

## Goal
Close the open lows and missing tests from `docs/briefs/PRICE-4.review-1..4.md` on the Pricing portfolio and `csv.ts`, without breaking any D69 pinned output.

## Definition of done
- Every missing test listed in reviews 1-4 exists and passes (list in step 1-3), none loosened.
- Gate green; no D69 pin changed; no new dependency.
- Agent redirect from `/app/pricing` and `/app/products/planner` is tested.
- Items judged by D69 (6) or needing a decision are left open and named in PROGRESS.

## Stale (already done, verify only)
- Sidebar label: `nav.pricing` is already "Pricing" in en.json:33. Check ar.json:33 reads "التسعير"; fix if not.
- Inactive filter, capital column, tap targets, fifth card span: fixed in rounds 2-3; do not redo.

## Steps (commit each with scripts/step.sh)
1. `src/lib/csv.test.ts` only, add tests that pass on current code: CRLF in a value (`Ali\r\n=1`), lone CR, value starting with `;` (`;=1` -> `";'=1"`), `\r=1` keeps leading apostrophe, `Ali;\t=1`, NBSP after separator, `Ali;-1500` stays bare, null/undefined/NaN/Infinity output, a negative amount string. Pin real behaviour; if a case shows a bug, stop and report.
2. Same file: an orders-style whole-row test using the real `exportRows` columns. Cheapest: move nothing; build the same columns inline (D69 forbids moving columns out of the table for round 4, a new task may export them, so extract `orders-all-table.tsx` columns to a small const only if it is a behaviour-preserving move).
3. `src/lib/pricing-portfolio.ts` + test: CSV `margin` header says percent or export percent; `minPrice` exported as the ceiling shown in table; round to 2 decimals (review-3 low 3). Test for each.
4. `src/app/(app)/app/pricing/page.tsx` + `portfolio-view.tsx`: when products count >= 1000 show a warning that totals are partial (review-1 #9); otherwise paginate with `.range`. Prefer the warning: new string in `src/messages/{en,ar}.json` (key parity).
5. Small UI lows: product-name link tap height `max-sm:min-h-11`; compact icon chip with aria-label for below-break-even (review-3 low 5, 7); scroll-edge cue on the 13-column table (low 6), tokens only, logical props.
6. Test: agent session is redirected from `/app/pricing` and `/app/products/planner` (follow the pattern of existing RLS/session tests; if none can drive a server component, test `requireAdmin` redirect directly).
7. Screenshots (both themes, EN + AR, 1280 and 390): `/app/pricing` populated, empty if reachable. Note in PROGRESS.

## Acceptance tests by name
`csv.test.ts` new cases above; `pricing-portfolio.test.ts` "csv margin is percent", "csv minPrice is the ceiling", "csv rounds to 2 decimals"; "agent is redirected from pricing".

## Needs owner / new DECISIONS row (do NOT build)
- Review-4 low 1 (exempt only segments ending at a separator) contradicts D69 pins `0555123456;+213555123456` and `-1500<LF>=1`.
- Review-4 low 2 (quote U+2028/U+0085) is optional; D69 (3a) fixes the separator set. Skip unless owner agrees.
- Leading apostrophe visible, full-width lookalikes, Excel phone leading zero, comma file on `;` locale (Q-24): accepted limits, D69 (6).

## Edge cases
- `toCSV` is shared with orders export: any change to `esc()` affects customer text.
- CSV margin change alters downstream readers of the export; none in repo expected, grep `PORTFOLIO_COLUMNS` first.
