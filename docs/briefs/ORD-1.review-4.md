VERDICT: PASS
## Summary
Round 4 (D59, ui-reviewer only, points 1 and 2). The round-4 diff touches only `data-table.tsx`, `orders.order_seq.rls.test.ts`, PROGRESS.md and r4 screenshots, so the normal routing does not apply.
Point 1: there is exactly one keyboard focus indicator. With the table focused and no row current, the table outline shows and no row has a ring. Once a row is current, the outline is off and one row ring shows. This held on orders/all, delivery and product orders.
Point 2: the frozen-column divider is an `after:` line on the sticky header and body cells, on the `end-0` side, coloured with the `bg-border-strong` variable. It stays with the column when the table scrolls sideways, mirrors in AR, and leaves the row lines intact (`border-collapse`, rows keep `border-bottom`).
No high or medium findings.

## Findings
None at high, medium or low severity.

Evidence:
- `src/components/data-table/data-table.tsx:252`: the table gets `focus-visible:outline-none` only when `focus >= 0 && tableFocused`.
- `data-table.tsx:340`: the current row has `ring-2 ring-inset ring-ring`.
- `data-table.tsx:277-278` (header) and `:360-361` (body): the sticky divider.
- `border-strong` is defined in `(app)/globals.css:97` (dark) and `:144` (light).
- Measured in the browser, scrolled sideways:
  - EN light: `::after` at `right: 0`, colour `lab(9.4 / 0.22)`.
  - AR dark: `::after` on the cell's left edge (the logical end in RTL), colour `lab(100 / 0.18)`.

Screenshots in `docs/design/audit/ORD-1/`:
- `r4rev-all-ar-dark-row.png`
- `r4rev-all-en-light-row.png`
- `r4rev-product-ar-dark.png`
- `r4rev-product-en-light.png`

## Not covered (carry into ORD-1-F per D59 point 6)
- Real Tab keypress: the review used `table.focus()` plus a synthetic ArrowDown. `:focus-visible` matched, but a physical Tab was not exercised.
- No screenshots of EN dark and AR light.
- Delivery was checked by computed values only, with no screenshot.
- A row hovered while the table is scrolled sideways was not exercised by the reviewer.
- The gate and live database tests were not run by the reviewer. They are the builder's D59 point 5 and outside the scope of this UI round.

## Missing tests
- Automated test of the orders/all error state: already deferred to ORD-1-F by D59 (4f).
