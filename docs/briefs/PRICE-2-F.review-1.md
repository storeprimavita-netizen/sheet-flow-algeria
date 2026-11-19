VERDICT: FIX

## Summary
Reviewed by ui-reviewer (risk low, surface ui). Gate passed (tsc, 761 tests with live RLS, i18n parity, color lint, build).
Helpers, focus flow, range messages, separators, fee warning and invalid-quantity behaviour match the brief and look right on screen.
One medium: the new live action test shares fixtures with `rls.test.ts` and races with it under Vitest's default file parallelism.
Everything else is low. Screenshots: `docs/design/audit/PRICE-2-F/` (partial matrix, listed below).

## Findings

### 1. MEDIUM: live action test races with rls.test.ts on shared fixtures
- **Where:** `src/app/(app)/app/products/[id]/pricing/actions.live.test.ts` beforeAll L32-50, afterAll L52-55. `vitest.config.ts` has no `fileParallelism: false`.
- **Failure 1:** On a fresh DB, when this file runs before `rls.test.ts` has created "RLS Test WS2", beforeAll throws "run src/lib/rls.test.ts first".
- **Failure 2:** Both files insert "WS2-only product" if it is missing (`rls.test.ts` L105-111, live L46-47). Run at the same time, they can create two rows. The `.single()` lookup in `rls.test.ts` ~L205-210 then fails.
- **Failure 3:** The live `afterAll` deletes all `product_pricing` rows for that ws2 product. `rls.test.ts` L212-219 inserts a row for the same product and then asserts `mine` has length 1. If the delete lands in between, the gate goes red with nothing actually wrong.
- **Fix:** Give the live test fixtures it owns and creates itself: its own workspace, product and admin, created in beforeAll and removed in afterAll. That also removes the ordering dependency. Smaller options: run the live case inside `rls.test.ts`, or turn off file parallelism for the live suites. In every option, limit the `afterAll` delete to rows the test itself created.

### 2. LOW: grouped display value contains NBSP
- **Where:** `src/components/fields/number-field.tsx` ~L58.
- **Failure:** None today, because the field is controlled and parsed on change. If a `group` field is ever used in a native form submit, it would post "10 000".
- **Fix:** Strip NBSP and thin spaces in `parseNumberInput`, or add a comment saying the field is controlled-only.

### 3. LOW: brief step 4 was only partly extracted
- **Where:** `pricing-calculator.tsx` ~L56.
- **What's missing:** `nextApplied` and the validators were extracted to `pricing-form.ts`, but the dirty / `saveSnapshot` logic is still in the component. Behaviour on screen is correct: with quantity "1421.5" the overrides still apply and the inline error shows.
- **Fix:** Move the dirty logic into a pure helper with a unit test, or note in PROGRESS that it was deliberately left in the component.

### 4. LOW: #10 and #11 not touched; already fixed
- **Where:** `pricing-results.tsx`.
- **What's on screen:** Group headers are already `sticky start-0`, and the AR chips do not clip at 390 px (`scrollWidth` 390).
- **Fix:** Record "already fixed, verified on screen" in the PROGRESS note.

## Missing tests
- `groupDigits` unit tests: decimals, negative numbers, "1.2.3", empty string.
- `PLATFORM_PCT_WARN` boundary: exactly 50 does not warn, 50.01 warns.
- `rangeHint`: cases for the `gtLt` / `geUp` kinds, plus a test that every returned kind has a message key in both en and ar.
- `product_pricing product_id cross-workspace UPDATE refused` accepts either an error or an empty result. Pin the expected outcome (error code, or 0 rows) so that a policy change can't pass silently.

## Verified on screen
- Settings pricing, 1280: dark EN and light AR. Fee warning at 60% shows and still saves. 150% shows the range text and suppresses the warning. "1.2.3" shows "Not a number.".
- Reset dialog, keyboard only: Enter on Reset puts focus on confirm. Escape returns focus to Reset. Confirm sends focus to the first field.
- Product pricing at 1280 dark AR with an invalid quantity, and at 390 light AR with no horizontal scroll.
- Not captured: product pricing dark EN, the fee warning at 390, the overridden chip at 390 AR. Capture these in the fix round.
