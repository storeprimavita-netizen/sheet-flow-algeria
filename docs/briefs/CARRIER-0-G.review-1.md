VERDICT: FIX

## Summary
Diff matches the brief: cells focusable with role/aria-label/Enter+Space, svg role="group", dashboard bar `sm:sticky`, `hasMoreScroll` extracted and tested.
One medium blocks PASS: the keyboard focus ring is a hairline (see the committed screenshot `stats-390-ar-light-focus.png`). It fails visible-focus / non-text contrast, so the "visible focus ring" Done-when is not met.
Map follows the table in DOM order (`wilaya-section.tsx:56,60`) and `hovered`/`onHover` are wired, so the 58 tab stops are an accepted trade-off per the brief.
Reviewer: ui-reviewer (read the diff and screenshot; it did not drive the browser itself). The orchestrator checked the screenshot and code.

## Findings

1. **MEDIUM** — `src/components/dashboard/algeria-map.tsx:135,141`. The focus indicator is barely visible.
   - **What happens:** `focus-visible:stroke-ring` changes only the colour. The width stays `isHovered ? 1.5 : 0.75`. Neighbouring paths render later and overdraw half of each shared edge with `stroke-background`. The outer edges are cut by the clipPath. The screenshot shows a faint green hairline on grey, under the 3:1 contrast WCAG asks for (2.4.7 / 1.4.11). A keyboard user can't easily see which wilaya Enter will open.
   - **Fix:**
     - Draw the focused or hovered cell a second time on top, after the cells loop: a `pointer-events-none fill-none stroke-ring` path with `aria-hidden`.
     - Give it strokeWidth ≥ 2 so it does not depend on being overdrawn.
     - Keep the colours as tokens. Verify in both themes.

2. **LOW** — `algeria-map.tsx:138-139`. The cells stay focusable and announced as links even when `onSelect` is undefined. Gate `tabIndex`/`role`/`onKeyDown` on `onSelect`. `role="button"` fits Space activation better, but `link` is the brief's choice and is acceptable.

3. **LOW** — `algeria-map.tsx:138`. 58 tab stops. They come after the table in DOM order, so this is acceptable. A roving tabindex is an optional follow-up.

4. **LOW** — `src/components/stats/wilaya-table.tsx:21-31`. `hasMoreScroll` was inserted between the `WilayaTable` docblock and the component. The helper now carries the component's doc comment and the component has none. Move the helper above the docblock.

5. **LOW** — `src/app/(app)/app/dashboard/dashboard-filter-bar.tsx:81`. Class order is non-canonical (`z-10 sm:sticky sm:top-0 w-full`). It works, but fix it to keep the class list tidy.

6. **LOW** — AR map labels use Latin wilaya names (there is no `name_ar` column, per the brief). Make sure the follow-up row is recorded. If `wilayaTitle` does not already wrap the Latin name in bidi isolation, do so inside the Arabic "no data" string.

## Missing tests
- No behaviour test for the key handler: Enter/Space should call `onSelect` and `preventDefault`, and other keys should do nothing. The source-grep would still pass if the handler were broken. The pure keydown logic could be extracted and unit-tested, or checked with a `react-dom/server` render (58 `tabindex="0"` cells, each with an aria-label).
- No test that `role="group"` stays on the svg.
- The `names` wiring test greps exact strings in `statistics/page.tsx`, which is brittle. Prefer a `wilayaTitle(datum-without-name, noData, names)` assertion.
