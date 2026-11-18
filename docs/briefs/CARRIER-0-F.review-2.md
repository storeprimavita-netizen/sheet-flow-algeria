VERDICT: FIX

## Summary
Review-1 legend, tooltip and separator findings are fixed and confirmed live (AR+EN, 390). Legend reads `<40%`…`85%+` in `bdi[dir=ltr]`, no page h-scroll at 390.
Two mediums remain. The four 1280 PNGs predate the label change: they were taken in 77413cf, before f8c5e55, and still show "16-Alger". At 390 px the new `min-w-[34rem]` table hides the delivery-rate and stop-shipping columns with no scroll hint.
Reviewer: ui-reviewer, live chrome-devtools (EN light 390, AR dark 390) plus the committed PNGs. Live 1280 could not be emulated, so it was judged from the PNGs only.

## Findings (ranked)

1. **Medium**: `docs/design/audit/CARRIER-0/map-{light,dark}-{en,ar}-1280.png`
   - Failure: all four desktop shots come from 77413cf, before f8c5e55 changed the table label. EN dark shows "16-Alger" and AR light shows "Alger-16" (the old hyphen format). The live page and the 390 PNGs show `code · name`. The desktop evidence does not reflect the shipped code.
   - Fix: retake the four 1280 shots on the current code (card framed, no dev badge).

2. **Medium**: `src/app/app/dashboard/wilaya-section.tsx:45` (`min-w-[34rem]`)
   - Failure: at 390 px the table scrolls inside the card with no visible affordance. Only wilaya, total, confirmed and delivered are visible. The delivery-rate and stop-shipping columns are off-screen, and stop-shipping is the key action signal of this table.
   - Fix: add a scroll affordance (an edge fade or a hint), or hide the low-value columns below `sm` and surface the stop flag as a badge on the name cell.

3. **Low**: `src/app/app/dashboard/wilaya-section.tsx:66`
   - Failure: `<span aria-hidden> · </span>` removes the only separator from the accessibility tree, so screen readers read "16Alger".
   - Fix: drop `aria-hidden` from the separator, or add a visually hidden space.

4. **Low**: `src/app/app/dashboard/wilaya-section.tsx:102-106` (legend)
   - Failure: at 390 px the legend still wraps unevenly ("85%+" and "No data" sit alone on the second row). This is review-1 low 4, not addressed.
   - Fix: use `grid grid-cols-3` at narrow widths.

5. **Low**: `src/components/dashboard/algeria-map.tsx`
   - Failure: map cells have no keyboard access (deferred by the brief as optional). The table links are the only keyboard drill-through.
   - Fix: when convenient, make the cells focusable links or buttons with an accessible name.

6. **Low**: `src/app/app/dashboard/page.tsx` (390)
   - Failure: the sticky filter panel takes about 40% of the viewport and covers the table head when scrolled. The shipped 390 PNGs frame the card correctly, but live use is cramped.
   - Fix: collapse the filters on scroll at narrow widths (follow-up, not blocking).

## Missing tests
- Nothing asserts the table label structure (`bdi[dir=ltr]` code, separator, `bdi` name). The new test only greps the legend labels in the source.
- No unit test for the tooltip title: the `name ?? names[code] ?? code` fallback chain and the `noData` label. Extract a pure `titleText(wd, noDataLabel, names)` and test it.
