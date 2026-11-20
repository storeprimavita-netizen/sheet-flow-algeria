VERDICT: FIX

## Summary
Reviewers: qa-reviewer (numbers, CSV helper) and ui-reviewer (screens, live browser). All round-1 findings are fixed except the 1,000-row cap, which was deferred and is acceptable at the current size. The portfolio math is correct and lives only in `pricing-portfolio.ts`. Capital is stock plus ads in DZD, cards and totals sum the same rows, and the page is admin-guarded twice.
One medium finding blocks: the new formula guard in the shared `csv.ts` puts an apostrophe in front of `+213…` phone numbers in the orders export.
The screens pass at 1280 and 390 in LTR and RTL: the sticky name column works, the page does not scroll sideways, and numbers use tabular figures. Only low findings remain on the UI side.

## Findings (ranked)

**M1 · medium · src/lib/csv.ts:15** — Any string starting with `+` gets an apostrophe, so `"+213555123456"` exports as `'+213555123456` and `"+213 555 12 34 56"` as `'+213 555 12 34 56` (the qa-reviewer's probe against the real `toCSV`). Excel and LibreOffice show the apostrophe as part of the cell. `orders.customer_phone` is stored raw from webhooks (`webhook.ts:257`) and manual orders (`orders/actions.ts:445`), so any `+213` phone in the orders export is damaged.
Fix: do not add the prefix when the value is purely numeric-like (`/^[+-]?\d[\d .]*$/`, which cannot call a function). Keep the prefix for `=`, `@`, TAB, CR, and for `+`/`-` followed by anything else. Optionally export the phone through `normalizeDzPhone` in `orders-all-table.tsx:107`.

**L1 · low · src/lib/pricing-portfolio.ts (capital cell)** — An override that makes the price null (for example a 100% platform fee) still computes `totalAdDzd`. The row then shows a capital cell but is left out of the totals, so the visible column no longer adds up to the card. Fix: return null from the `capital` value when `!isIncluded(row, s)`.

**L2 · low · src/lib/pricing-portfolio.test.ts** ("no revenue gives a null margin") — The test uses `pricing: null`, a row that is excluded, so it never reaches the `revenue > 0` guard. Fix: build an included row with zero revenue, or drop the test.

**L3 · low · src/lib/csv.ts:15** — Lookalike formula starts are not neutralised: `" =1+1"` (leading space) is only quoted, and full-width `＝` is not prefixed. Excel does not evaluate these, but some importers trim leading spaces. Optional fix: test the regex against `s.trimStart()`.

**L4 · low · existing before this task** — `"0555123456"` passes through `csv.ts` unchanged, which is correct, but Excel's default CSV open still drops the leading zero. Not caused by this diff. Owner choice: `="0555…"` or an XLSX export.

**L5 · low · src/app/(app)/app/pricing/portfolio-view.tsx:~94-104** — The scenario toggle and Export CSV buttons are 32 px tall at 390, below the 44 px tap-target guideline. Fix: add `min-h-11` below `sm`.

**L6 · low · portfolio-view.tsx:~86** — At 390 the fifth card (Blended margin) sits alone in a half-empty row of the 2-column grid. Fix: `[&>:last-child]:col-span-2 lg:[&>:last-child]:col-span-1`.

## Not verified live (needs DB writes, which reviewers were not allowed to make)
The empty state, a row with missing cost ("—" and "N products not included"), the error and retry state, the agent redirect, and the actual CSV download and its contents. The skeleton was checked from code only. 1280 light EN, 1280 dark AR and 390 light EN were not re-shot by the reviewer; the builder's r2 screenshots cover them.

## Missing tests
- `csv.test.ts`: `"+213555123456"` and `"0555123456"` come out unchanged; `"+cmd"`, `"-2+3"`, `"=1+1"` and `"@x"` still get the prefix; an orders-style row with BOM, CRLF and an Arabic name containing a comma and quotes.
- The capital cell is null when net profit is null but ad spend computes (L1).
- A reachable included row that hits the zero-revenue margin guard (L2).
- An agent session redirected away from `/app/pricing` and `/app/products/planner`.
- A `PortfolioView` component test: the empty state, a "—" row with the "N not included" line, and the toggle updating the cards.
- The loader throws on `product_costs` / `product_pricing` errors and the error boundary shows.
