# CARRIER-0-G — map keyboard access, phone filter bar, review-3 lows

risk: low · surface: ui · lane: orders

## Goal
Wilaya map cells are keyboard-operable, the filter bars stop covering content on phones, and the review-3 test gaps are closed.

## Done when
- Each of the 58 map cells is focusable (tabindex 0), has role="link" and an aria-label from `wilayaTitle`, and Enter/Space calls `onSelect`. A visible focus ring uses tokens, and focus syncs hover (`onHover`).
- `dashboard-filter-bar.tsx` is not sticky below `sm` (`sm:sticky sm:top-0`), matching `stats-filter-bar.tsx`.
- Tests exist for the scroll-fade `measure` with negative RTL scrollLeft and for the `names` wiring from statistics page into the map.
- Wilaya names in AR: confirmed no Arabic name field exists in the DB (see assumptions). No change, no new decision.
- `scripts/gate.sh` passes. No hardcoded colors.

## Files
1. `src/components/dashboard/algeria-map.tsx`: on each cell `<path>` add `tabIndex={0} role="link" aria-label={titleText}`, `onKeyDown` (Enter/Space -> preventDefault + onSelect), `onFocus`/`onBlur` -> onHover, and `focus-visible:outline-none focus-visible:stroke-ring` plus a thicker strokeWidth when focused (the svg path outline is token-based). Change the svg from role="img" to role="group" so the children stay exposed to assistive tech. Keep `<title>`.
2. `src/app/(app)/app/dashboard/dashboard-filter-bar.tsx:81`: `sticky top-0` -> `sm:sticky sm:top-0`.
3. `src/components/stats/wilaya-table.tsx:56-71`: extract the pure `hasMoreScroll(scrollLeft, clientWidth, scrollWidth)` (uses Math.abs) and have `measure` call it. Export it.
4. `src/components/dashboard/algeria-map.test.ts`: add `hasMoreScroll` cases (LTR, RTL negative, at end, no overflow). Add a source-level check that the page builds `names` and passes it to WilayaSection, and that cells carry tabIndex/role (the existing tests use source-grep, no DOM setup, so keep to that style).
5. `docs/design/audit/CARRIER-0-G/`: screenshots.

## Steps (commit each with scripts/step.sh)
1. Extract `hasMoreScroll` and add its tests.
2. Map cell keyboard access, a names/structure test.
3. Dashboard filter bar `sm:sticky`.
4. Screenshots, PROGRESS.md note, and a gate run.

## Screens to screenshot (chrome-devtools, EN + AR, dark + light as feasible)
- `/app/statistics` at 390: map with a focused cell via keyboard Tab (focus ring visible), and the table scroll fade in AR.
- `/app/dashboard` at 390: the filter bar scrolls away and does not cover content.
- `/app/statistics` at 1280: no regression.

## Edge cases and assumptions
- Assumption confirmed: the map exists only on `/app/statistics` (`statistics/page.tsx` -> `components/stats/wilaya-section.tsx`). The dashboard has no map, so the "covering the map" complaint now applies to the dashboard filter bar. `stats-filter-bar.tsx` is already `sm:sticky`.
- 58 tab stops is long. Mitigation: cells go after the table in DOM order and the table links are the primary route. If this is judged noisy, use a roving tabindex (one stop, arrows move), but only if cheap. Not required.
- Wilaya names come from `wilayas.name` (Latin, seed 00007). No `name_ar` column exists in any migration. An Arabic names list would need a migration plus seed, which is out of scope. Record it as a follow-up row only; it needs no DECISIONS row yet.
- `onSelect` already pushes `?wilaya=` without scroll, so keyboard activation reuses it.
- No raw colors: use `stroke-ring`, `stroke-background` tokens.
