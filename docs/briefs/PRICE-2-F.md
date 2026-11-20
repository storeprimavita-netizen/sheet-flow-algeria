risk: low · surface: ui · lane: catalog

# PRICE-2-F — PRICE-2 follow-up (D40, D53)

Goal: pin the keyboard behaviour D53(b) asked for with pure-helper unit tests (no new dependency), and close
the cheap lows from `docs/briefs/PRICE-2.review-3.md` (#5-#13) and `review-4.md` (#2, #3, #5) plus the missing tests.
No table, RLS, formula or migration change (so risk low; the RLS test file is only extended).

## Definition of done
- [ ] `withTargetMode`, `closeFocusTarget`, `radioTabIndex` live in `src/lib/pricing-form.ts`, are used by the components and have unit tests (review-4 #1).
- [ ] The stale `didReset` flag cannot misdirect focus; touch/mouse reset does not open the phone keyboard (review-4 #2, #3).
- [ ] Review-3 #5 fixed: table does not freeze on invalid quantity while overrides still apply (or shows "table paused"); #6, #7, #10, #12 done; #8, #9, #11, #13 only if still true when verified on screen.
- [ ] Missing tests added: calculator logic, `product_pricing` audit rows, cross-workspace `product_id` UPDATE, live `saveProductPricing`, AR cell text.
- [ ] `scripts/gate.sh` passes; EN/AR key parity holds.

## Files and changes
1. `src/lib/pricing-form.ts` (+ `pricing-form.test.ts`): add the three helpers. `withTargetMode(form, mode)` returns the same form when mode unchanged, else `targetValue: null` (D52 holds). `closeFocusTarget({didReset, btnDisabled})` -> `"button"|"firstField"`. `radioTabIndex(checked)` -> 0/-1. Add a pure `focusIdFor(idPrefix, key)` (dotted keys such as `adMultiplier.best`) and test it.
2. `src/components/pricing/pricing-fields.tsx` (~L130, ~L234-274): call the helpers; move focus after a reset only when `e.detail === 0` (keyboard); keep id from `focusIdFor`. Range errors state the range / "not a number" (#6); thousands separators in money inputs and "Default: 10000" placeholders via `src/lib/format.ts` (#7).
3. `src/app/(app)/app/settings/pricing-section.tsx` (L57, ~L115-124): clear `didReset` when the dialog opens, decide with `closeFocusTarget`. Platform fee over a sane limit (e.g. > 50%) shows a warning line, still saves (#12).
4. `src/app/(app)/app/products/[id]/pricing/pricing-calculator.tsx` (~L88-104): `applied` keeps following overrides/final price while only quantity is invalid, or an explicit "table paused: fix quantity" line (#5; pick the first, it is smaller). Extract the quantity/stock-cost/dirty logic into a pure function in `src/lib/pricing-form.ts` so it is testable.
5. `pricing-results.tsx`: group header rows sticky (#11 only if still not sticky); AR chip wrap at 390 px (#10) via `min-w-0`/`whitespace-nowrap` and shorter chip text if needed.
6. `src/messages/{en,ar}.json`: new strings (range text, paused/warning lines), same keys in both.
7. Tests: `src/lib/rls.test.ts` add (a) UPDATE moving `product_id` to another workspace's product refused (dedicated row, not the PK), (b) audit_log rows for `product_pricing` INSERT/UPDATE/DELETE; `actions.test.ts` add a live (unmocked) `saveProductPricing` with a ws2 product id refused; `pricing-cell.test.ts` add AR "—" / "Not possible".

## Step order (each pushed with scripts/step.sh)
1 helpers + unit tests · 2 wire helpers into fields and settings dialog (focus fixes) · 3 calculator pure logic + #5 + tests · 4 form messages: ranges, separators, fee warning (EN/AR) · 5 RLS/audit/live action tests · 6 UI polish #10/#11 · 7 screenshots + PROGRESS note.

## Acceptance tests (by name)
`withTargetMode clears value on mode change`, `withTargetMode same mode keeps form`, `closeFocusTarget escape/cancel -> button`, `closeFocusTarget after reset or disabled -> firstField`, `radioTabIndex roving`, `focusIdFor dotted key`, `calculator: invalid quantity keeps overrides applied`, `product_pricing audit INSERT/UPDATE/DELETE`, `product_pricing product_id cross-workspace UPDATE refused`, `saveProductPricing refuses ws2 product`, `PricingCell AR`.

## Screenshots (both themes, EN + AR)
Product pricing page 1280 and 390 px (invalid quantity, below break-even, overridden chip AR); Settings pricing section with fee warning and reset dialog; keyboard walk: reset a field, close dialog by Escape.

## Edge cases / assumptions
- Some lows may already be fixed by rounds 3-4: verify each on the screen first, skip and note the ones already gone.
- Component-level DOM focus tests are out: no jsdom/testing-library and adding one is an unplanned dependency (owner). The helper tests plus the on-screen keyboard walk replace them; say so in PROGRESS.
- Review-4 #4 (focus token contrast) is a design-system measurement, not here; leave in the plan as a note.
- Focus restore via `requestAnimationFrame` + `getElementById` is kept, protected by `focusIdFor`.
- No new DECISIONS row needed (D52, D53 cover it).
