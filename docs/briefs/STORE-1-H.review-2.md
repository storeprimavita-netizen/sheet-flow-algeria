VERDICT: PASS

## Summary
Reviewed by qa-reviewer (owasp-security) and ui-reviewer against `git diff v3...v3-STORE-1-H`. Both found no high or medium issues.
qa: the three touched suites ran live, 61/61 pass. `scripts/gate.sh --fast` passed (923 passed, 5 skipped). The guard and action tests cannot false-pass. The PUBLIC/anon grant check was proven by granting TRUNCATE inside a transaction that was rolled back.
Review-1 findings 1-6, 8 and 9 are fixed. Findings 7 (`showsSizeCell`/`showsCard` duplication) and 10 (screenshot matrix) are still open, as lows.
ui: static review only (no live browser). The chip in `stock-390-ar-dark.png` is narrow, RTL-correct and uses tabular figures.

## Findings (all low)
1. **Low — `docs/design/audit/STORE-1-H-ui/` stale screenshots.**
   - `unnamed-option-390-en-light.png` was taken before the value placeholder (`variants-editor.tsx:139`). It shows an empty value box.
   - `stock-390-en-dark.png` and `stock-390-ar-light.png` were taken after the seed was reverted, so they show no Low/Out chip.
   - The only shots with the chip (`stock-390-en-light.png`, `stock-390-ar-dark.png`) predate the `<bdi>` change.
   - Fix: re-seed stock 3 and stock 0, retake EN dark, AR light and the unnamed-option shot, then revert the seed.
2. **Low — `src/app/(app)/app/orders/[id]/page.tsx:145,180`.** `showsCard` and `showsSizeCell` each compute `isAdmin && productSizes.length > 0`. They match today but can drift apart. Fix: compute `showsCard` once and use it to derive the cell, or use a single exported helper.
3. **Low — screenshot coverage.** Missing shots:
   - unnamed option in EN dark and AR light
   - product edit full page in dark, AR and 390
4. **Low — `src/lib/variants.rls.test.ts:705-710`.** The clean case runs an edited copy of the guard on an empty workspace, not the real migration text on clean data. It only proves the guard does not always raise. This is acceptable under the brief.
5. **Low — `variants-editor.tsx:117`.** The fallback placeholder is set on named inputs too (harmless). A whitespace-only name looks blank and shows no placeholder. Zod `trim().min(1)` (`variants.ts:12`) refuses that name on save, so no bad data can result.

## Missing tests
- `saveVariantConfig` refused for a non-admin. The rbac mock always returns an admin, so nothing proves `adminProfile()` runs before zod.
- Value-input placeholder rendered in EN and AR.
- Option-name `aria-label` kept.
- No fallback placeholder for a named option in AR.
- Stock page wiring: the isOut/isLow thresholds and the `t("stock.*")` labels passed into `StockLevelChip`.
- Order page call site of `showsSizeCell` (`order.variant ?? ""`). Cosmetic only.
