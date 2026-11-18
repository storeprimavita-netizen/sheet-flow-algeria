VERDICT: FIX

## Summary
Reviewers: qa-reviewer (risk high) and ui-reviewer (surface ui). Diff `git diff v3...v3-PRICE-2`.
No high findings. The database wall holds: on the local DB an agent's select / update / delete on `product_pricing` touch 0 rows, an agent insert is refused by RLS, the composite FK and audit trigger work, and `database.types.ts` matches a fresh local regen. The 5 changed unit test files pass 49/49. The 1,632 × 50 stock cost and the percent → fraction conversion are correct.
There are 5 medium findings (form state and missing tests) and one coverage gap: **the ui-reviewer read the code only — it did not run the app or take screenshots**, so both themes, AR/EN, 390 px and desktop are still unverified. No finding needs an owner decision.

## Findings

### 1. Medium: percent fields show one value while the form holds another
- **Where:** `src/components/fields/percent-field.tsx:56-58` (`clamp()`).
- **Failure:** on blur, `clamp()` only updates the text on screen and never calls `onChange`. Type 120 in "Confirmation best": the field shows "100%", the form still holds 120, the range error shows and Save stays disabled. Markup 1500 shows 1000% but holds 1500. 33.333 shows 33.33 but 0.33333 is saved.
- **Fix:** in `clamp()`, call `onChange?.(parsePercentInput(normalized, nullable))` when the normalised text differs. Add a test.

### 2. Medium: an override equal to the current workspace default is dropped
- **Where:** `src/lib/pricing-form.ts` `overridesFromForm` (~l.205-215) and `formFromOverrides` (hides the "Overridden" chip).
- **Failure:** a product overrides share 50%. The owner later sets the workspace share to 50%, edits only the ad cost on that product and saves: the share override is deleted. When the workspace share later moves to 30%, that product's price changes without warning. Same if settings change in another tab between page load and Save. A value the owner types on purpose that happens to equal the default is also not pinned.
- **Fix:** a value the owner typed, and any key already in the saved overrides, is stored as an override even when it equals the default; it is removed only by the field's reset. Show the "Overridden" chip for it. Add tests for both paths.

### 3. Medium: target mode switched with an empty value can be saved
- **Where:** `pricing-calculator.tsx` Save; `pricing-form.ts` `overridesFromForm`.
- **Failure:** switching the target mode away from the default and leaving the value empty saves `target {mode, value: null}`. Save stays enabled and every price on that product shows "—" from then on; only a warning line is shown.
- **Fix:** while the mode differs from the default and the value is empty, treat the field as invalid and block Save (reason shown at the field).

### 4. Medium: quantity is not validated — NaN reaches the engine
- **Where:** `src/components/fields/number-field.tsx` `parseNumberInput`; `pricing-calculator.tsx` (`Math.floor(NaN)`, `applied.quantity`).
- **Failure:** "1.2.3" gives `NaN`, which reaches `computeAll` with no error state. `JSON.stringify` turns NaN into null in the dirty check, which hides the change.
- **Fix:** `parseNumberInput` returns null (or flags invalid) when the result is not finite; quantity gets a validity check (integer, ≥ 0, with a maximum) and an error state; keep the last valid table.

### 5. Medium: the brief's action-level tests are missing
- **Failure:** the brief requires "`saveProductPricing` rejects non-UUID, other-workspace id, agent" and "settings save agent refused". No test calls `saveProductPricing`, `savePricingDefaults` or `resetPricingDefaults`; only the zod schemas and direct PostgREST access are tested.
- **Fix:** add action tests: non-UUID input, a product id from another workspace returns `notFound` (the `.eq("workspace_id")` path), an agent session rejected for all three actions, an invalid settings payload.

### 6. Medium (coverage gap): no screenshot review
- **Failure:** the build stage screenshotted dark / EN / ~430 px only; the ui-reviewer took none. Light theme, Arabic RTL, 390 px and desktop are unverified, and some "Default:" placeholders were seen clipping.
- **Fix:** screenshot Settings → Pricing and the product Pricing tab in dark + light, EN + AR, 390 px + desktop; fix what they show (including the clipped placeholders); note it in PROGRESS.md. The next review must run the app.

### 7. Low: cent rounding mismatch gives a vague error and changes saved values
- **Where:** `pricing-form.ts` `productPricingInputSchema`.
- **Failure:** zod accepts `finalPrice: 0.004`, `numeric(12,2)` rounds it to 0.00, the `> 0` check fails and the user sees a generic "failed" toast. Ad cost 2.255 is stored as 2.26, so the table differs after a reload.
- **Fix:** `.multipleOf(0.01)` or round to 2 decimals in the schema.

### 8. Low: "—" with "Missing input" when no price is possible
- **Where:** `breakEvenState` (end of `pricing-form.ts`).
- **Failure:** a platform % of about 55% or more (k ≥ 1 with the default rates) passes validation; every price shows "—" labelled "Missing input", though nothing is missing.
- **Fix:** classify a null `denom` as "impossible", or validate pct < O/B.

### 9. Low: anon keeps table grants on `product_pricing`
- **Failure:** the brief says "no anon grants"; anon still has the default grants (TRUNCATE included). RLS blocks it and the other financial tables are the same, so it is not reachable through PostgREST.
- **Fix:** `revoke all on public.product_pricing from anon;` in 00039.

### 10. Low: `format()` case "int" depends on `formatCurrency` output
- **Where:** `pricing-results.tsx` (`.replace(/ DA⁩$/, "⁩")`).
- **Fix:** add a `formatInt` helper in `src/lib/format.ts`.

### 11. Low: unit labels "DA" / "USD" are hardcoded
- **Where:** `pricing-calculator.tsx` NumberField units.
- **Fix:** move to `src/messages/{en,ar}.json`.

### 12. Low: the `pricing_defaults` RLS test wipes shared settings
- **Where:** `src/lib/rls.test.ts`.
- **Failure:** it changes workspace-wide settings and then deletes them, wiping a seeded or saved value in the shared local DB.
- **Fix:** restore the previous value afterwards, or use a throwaway workspace (TEST-1 rule).

### 13. Low: field state changes are not announced
- **Failure:** the unsaved cue, "Overridden" chip and error text are not announced when a field changes; only the save state has `aria-live`.
- **Fix:** tie error text to the field with `aria-describedby` / `aria-invalid`.

## Missing tests
- Action tests as in finding 5.
- Audit rows on `product_pricing` INSERT / UPDATE / DELETE (`row_id` null).
- Changing `product_id` on an existing row to another workspace's product (composite FK on UPDATE).
- PercentField blur sending the clamped value through `onChange` (finding 1).
- An override equal to the default surviving a save of other fields; a typed value equal to the default being stored (finding 2).
- `overridesFromForm` with a mode switch and no value (finding 3).
- `parseNumberInput("1.2.3")`; calculator component test: edit quantity → stock cost recomputes, invalid input keeps the last valid table (finding 4).
- `breakEvenState` when k ≥ 1 (finding 8).
- PricingCell render of "—" and "Not possible" in the AR locale.

## Not checked
- `src/lib/rls.test.ts` was not run by the reviewers (a rolled-back probe covered the same policies). The full gate was not re-run in review.
- No screenshots (finding 6).
