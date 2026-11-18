VERDICT: ESCALATE

## Summary
Round 3: qa-reviewer (diff, 75 tests, tsc, rolled-back SQL probes) and ui-reviewer (app run, chrome-devtools, 8 combos per screen + keyboard pass; 23 `r3-*` shots in docs/design/audit/PRICE-2/). No high findings. RLS, composite FK, audit trigger, anon revoke hold. Round-2 #1, #2, #3, #5-#9 fixed and seen on screen; #4 fixed (region, tabIndex, sticky labels pinned, cut-off column as cue).
Three keyboard/focus mediums block PASS: focus lost after per-field reset, focus not returned after the Settings reset dialog closes, segmented control is not a real radio group and its focus ring is invisible on the selected segment.
ESCALATE because n = 3 without PASS (loop rule). Owner also asked to confirm low #4 (loss-making final price saves without confirmation).

## Findings (ranked)

### Medium
1. **Focus lost after a per-field reset** (ui, confirmed on screen; qa also lists it as round-2 #14 leftover)
   - Where: `src/components/pricing/pricing-fields.tsx:121` (override fields) and `:216` (target reset).
   - Failure: Enter on "Reset Profit target to the default" removes the button; `document.activeElement` becomes `<body>`. Keyboard users restart from the top of the page.
   - Fix: after reset, focus the field input (or the segmented control for target), e.g. a ref + `requestAnimationFrame(() => ref.current?.focus())` after the remount key changes.
2. **Settings reset dialog does not return focus to its trigger** (ui)
   - Where: `src/app/app/settings/pricing-section.tsx:110` (`<Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>` is controlled with no trigger).
   - Failure: Escape/Cancel closes the dialog and focus lands on `<body>`, not on "Reset to built-in defaults".
   - Fix: use `DialogTrigger asChild` on the button, or `onCloseAutoFocus` focusing a ref to the trigger.
3. **Profit-target segmented control is not a keyboard radio group** (ui)
   - Where: `src/components/pricing/pricing-fields.tsx:229-242`.
   - Failure: both `role="radio"` buttons are `tabIndex=0`; ArrowLeft/Right do nothing (WAI-ARIA radiogroup expects roving tabindex + arrows). Focus ring is `ring-1 ring-ring`, invisible on the selected `bg-primary` segment.
   - Fix: roving tabindex (checked = 0, other = -1), arrow keys move + select (respect RTL direction), and `focus-visible:ring-2 ring-offset-2` (or reuse the Radix ToggleGroup/RadioGroup primitive if one exists in `components/ui`).

### Low
4. **Loss-making final price saves silently** (ui) — 3000 DZD below break-even saves with only the red cue under the table. By design per brief, but needs an owner yes/no on a confirm or warning. `pricing-calculator.tsx` save path.
5. **Table freezes while quantity is invalid, Save stays enabled** (qa) — `pricing-calculator.tsx:88,101-104`: `applied` only follows `valid` (includes `qtyErr`), but Save does not depend on quantity. Overrides/final price edited during an invalid quantity are saved without ever being shown. Let `applied` follow overrides when only quantity is invalid, or show "table paused: fix quantity".
6. **Range errors are generic** (qa, round-2 #10) — `pricingV2.field.range` "Value out of range." also shown for malformed text "5.5.5"; state the range / "not a number".
7. **No thousands separators in money inputs and "Default: 10000" placeholders** (both, round-2 #12) — `pricing-fields.tsx:93,186`.
8. **Settings layout unchanged** (both, round-2 #13) — "Profit target" twice, empty grid cells at 1280 px, tiny group headings, share label "This product's share of the store" on the workspace form.
9. **Overridden chip / unsaved cue not announced; disabled Save faint in light mode** (qa + ui, round-2 #14) — not re-verified with a screen reader.
10. **AR 390 px wraps** (ui) — "1 معدّل" override chip and "Edit workspace defaults" link wrap to two lines.
11. **Group header rows (colspan) not sticky** in the results table (ui); row labels are.
12. **Platform fee 60% saves without a sanity warning** (ui, round-2 #11).
13. **Results table at 390 px** (qa, code read): the ui-reviewer saw the cut-off next column as a cue; an edge fade would still help. Optional.

## Missing tests
- Keyboard/focus: focus after per-field reset, focus returned after the reset dialog closes, arrow keys on the segmented control.
- Calculator component test: quantity edit recomputes stock cost, invalid input keeps last valid table, NaN disables Save, clearing final price saves null.
- Audit rows for `product_pricing` INSERT/UPDATE/DELETE (probe passes; only `settings` DELETE is tested).
- `rls.test.ts`: UPDATE moving `product_id` to another workspace's product is refused (needs a dedicated row; the probe hit the PK first).
- Live (non-mocked) `saveProductPricing` with a real ws2 product id.
- AR locale: results table uses "دج"; `PricingCell` "—" / "Not possible" in AR.
- Screens not captured: 390 px invalid and below-break-even states in AR and light (EN dark 390 only).
