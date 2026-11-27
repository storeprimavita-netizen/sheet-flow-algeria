VERDICT: FIX

## Summary
Re-check of fix commit 3fca9bc against review 1 (ui-reviewer, app run locally). Finding 1 is fixed.
Finding 2 is partly fixed and has an Arabic truncation regression; finding 3 is still open; finding 4 is partly fixed.
Targeted vitest passes (14 files, 117 tests). Full gate not run.

## Findings

1. **Medium (regression; review 1 #2 partly fixed): truncated Arabic crumbs lose their start**
   - Where: `src/components/breadcrumbs.tsx:83-90`.
   - Failure: `dir="auto"` skips `<bdi>` children when choosing a direction, so every crumb computes `ltr`. A long Arabic name (substituted in the browser) loses its opening words; the parent crumbs show only their end.
   - Fixed part: "Abaya Luxe (store demo)" now shows in full at 390 px on pricing (EN dark, AR light); no header overflow. Store preview at 390 px AR is still tight ("Abaya ...", 55 of 72 px).
   - Fix: remove the inner `<bdi>`, keep `dir="auto"` on the `Link`/`span` (tried in the browser: Arabic crumbs compute `rtl`).

2. **Medium (review 1 #3 not fixed): screenshot matrix not delivered**
   - Where: `docs/design/audit/NAV-2-F/`, `PROGRESS.md:1127`.
   - Failure: the folder holds only the two review-1 shots (state before the fix). PROGRESS still says "screenshots NOT taken ... applied blind"; no skip list.
   - Fix: after findings 1 and 3, take the brief's matrix, fix what it shows, state any skips, update the PROGRESS line. The seed has a store, so preview crumbs can be captured.

3. **Low (review 1 #4 partly fixed): long record still squeezes the "Preview draft" tail**
   - Where: `src/components/breadcrumbs.tsx:75-82`.
   - Failure: EN dark, long name substituted: the tail gets 8 of 83 px at 640, 17 at 700, 12 at 768. No page overflow.
   - Fix: `shrink-0` on the tail `li` when `rec.tail` is set, so only the record gives way.

## Review 1 status
- #1 crumb lost on tab switch: **fixed** (all product tabs and browser back; no render loop, no console errors on hard loads).
- #2 name unreadable at 390 px: partly (finding 1). #3 matrix: not fixed (finding 2). #4 Preview hidden: partly (finding 3).

## Missing tests
- Record re-registers on a path change under a persistent layout (the `nextRecord` test does not cover the effect).
- No `<bdi>` inside a `dir="auto"` crumb.
- Tail keeps its width when it follows a record.

## Not checked
- AR dark and EN light header; the width sweep was EN dark only, AR seen at 390 px light.
- Agent screens and the rest of the brief's matrix (outside the fix diff). Long names were browser-only substitutions.
