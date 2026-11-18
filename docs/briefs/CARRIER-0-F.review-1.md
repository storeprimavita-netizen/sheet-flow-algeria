VERDICT: FIX

## Summary
Code is correct. Legend labels sit in `bdi dir=ltr` and read `<40%`…`85%+` correctly. The tooltip uses `dashboard.wilaya.noData` (live AR title shows "— لا توجد بيانات"). The table code is wrapped in bdi. There is no horizontal scroll at 390 px.
The evidence does not meet the DoD: both new PNGs fail to frame the map card, and the EN/desktop screens required by acceptance were not taken.
Reviewer: ui-reviewer (ran the app with chrome-devtools; live probe was AR 390 px dark).

## Findings (ranked)

1. **Medium**: `docs/design/audit/CARRIER-0/map-light-ar-390.png`, `map-dark-ar-390.png`
   - Failure: the sticky filter panel covers the top of the map card, so the card title and the table head are hidden and the table is cut mid-row ("Mostaganem" is clipped). The Next.js dev "N" badge overlaps the card's bottom-left corner. The DoD says "both frame map + legend together", and the card is not framed.
   - Fix: scroll the card to the top of the viewport below the filter bar (or collapse the filters), hide the dev indicator (`devIndicators: false` for the shoot, or hide it via the console), and retake both PNGs.

2. **Medium**: acceptance not met (`PROGRESS.md:177`, "EN and desktop not retaken")
   - Failure: the brief's acceptance lists screens for AR+EN, light+dark, 390 px and desktop. Only AR 390 px light and dark were taken.
   - Fix: shoot EN 390 px light and dark, plus desktop AR and EN, and note them in PROGRESS.md. Alternatively, record an explicit owner-approved narrowing.

3. **Low**: `src/app/app/dashboard/wilaya-section.tsx:66`
   - Failure: `<bdi dir="ltr">{code}</bdi>-{name}` leaves the hyphen as a neutral between the isolated code and the name. With an Arabic name in RTL, the hyphen can render on the far side of the name.
   - Fix: wrap the name in `<bdi>` too, or use a separator that does not depend on bidi (a gap span).

4. **Low**: `src/app/app/dashboard/wilaya-section.tsx:100-105` (legend)
   - Failure: at 390 px the legend wraps 4 + 2, so `85%+` sits next to "لا توجد بيانات" on the second row. It is readable but looks unbalanced.
   - Fix: use a fixed `grid grid-cols-3` (or 2) for the legend at narrow widths.

5. **Low**: `src/components/dashboard/algeria-map.tsx:122`
   - Failure: `wd.name ?? wd.code` gives a bare number tooltip ("1 — لا توجد بيانات") for wilayas with no row data.
   - Fix: fall back to the wilaya name from the geometry or reference list.

## Missing tests
- The bdi test (`algeria-map.test.ts:48-55`) greps the source only. It cannot catch a regression where the label moves out of the bdi through a variable or a component. This is accepted, because the repo has no jsdom setup; the brief allowed "state so", and the test file states it.
- No test asserts that `noDataLabel` reaches the `<title>` text. A small exported `titleText(wd, noDataLabel)` pure function would be testable without jsdom.
- No assertion covers the table-label bdi.
