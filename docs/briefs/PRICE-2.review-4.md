VERDICT: ESCALATE

## Summary
Round 4 under D53(b), reviewed by qa-reviewer (code) and ui-reviewer (ran the app and used the keyboard: EN/AR, dark/light). No high findings.
Review-3 #1, #2 and #3 are all resolved, both in the code and on screen.
One medium remains: D53(b) asked for three keyboard tests, and only part of one exists. The rule says n ≥ 3 without PASS means ESCALATE.
Route per D53: gate OK and no high finding means merge under D40. Add the medium below to `PRICE-2-F` together with review-3's lows #5–#13.
Round 4 changed 4 client files (`git show b989407`). It touched no table, RLS, action or migration.

## Review-3 items (verified)
- **#1 Resolved.** `src/components/pricing/pricing-fields.tsx:130`: after a per-field reset, focus moves to the input by id. On screen: Packaging reset → focus on `pp-packaging`. `:234`: after the profit-target reset, focus goes to the radio of the default mode. On screen: focus on "Profit / piece (DA)".
- **#2 Resolved.** `src/app/app/settings/pricing-section.tsx:115-124` (`onCloseAutoFocus`). On screen: Escape and Cancel both return focus to "Reset to built-in defaults". A confirmed reset sends focus to `#pd-target`, because the button is disabled afterwards.
- **#3 Resolved.** `pricing-fields.tsx:243-274`:
  - roving tabindex: one tab stop, on the checked option;
  - arrow keys go through `targetModeForKey`, mirrored in RTL, and wrap at the ends;
  - `chooseMode` clears the value (D52 holds; on screen, 1800 became empty with "Required.");
  - the focus ring `ring-2 ring-ring ring-offset-2 ring-offset-background` comes from tokens and is visible in all four combinations.
  - Screenshots: `docs/design/audit/PRICE-2-r4/`.

## Findings (ranked)

1. **Medium.** `src/lib/pricing-form.test.ts:216-231`. **The keyboard tests D53(b) asked for are missing.**
   - **What exists:** only the pure key-to-mode mapping (`targetModeForKey`) is tested.
   - **What is not pinned:**
     - focus after a reset (#1);
     - where focus goes when the dialog closes (#2);
     - that a keyboard mode change clears the value;
     - the one-tab-stop rule.
   - **Failure:** someone changes `chooseMode` to keep `targetValue` on an arrow key, which reinterprets the value and breaks D52. Every test still passes.
   - **Fix:** no DOM test setup exists, and adding one would be a new dependency. Instead, move the logic into pure helpers in `pricing-form.ts` that the component calls, and unit-test them:
     - `withTargetMode(form, mode)`: returns the same form when the mode is unchanged, otherwise sets `targetValue: null`.
     - `closeFocusTarget({ didReset, btnDisabled })`: returns `"button"` or `"firstField"`.
     - `radioTabIndex(checked)`.

2. **Low.** `src/app/app/settings/pricing-section.tsx:57,119`. **A stale `didReset` flag sends focus to the wrong place later.**
   - **Failure:**
     1. Confirm the reset, then press Escape while the request is pending.
     2. `res.ok` arrives and sets `didReset = true` after the dialog has already closed.
     3. Later: save, reopen the dialog, press Cancel. Focus goes to `#pd-target` instead of the button.
   - **Fix:** clear `didReset` when the dialog opens, or decide from `btn.disabled` alone.

3. **Low.** `src/components/pricing/pricing-fields.tsx:130`. **Tapping a reset on a phone opens the on-screen keyboard.**
   - **Failure:** focus moves to the input on mouse and touch resets too, so on a phone the keyboard pops up over the results table.
   - **Fix:** move focus only when the reset came from the keyboard (`e.detail === 0`).

4. **Low (project-wide, not a regression).** The `--focus` token (`oklch(0.5 0.15 162 / 55%)`) may give the focus ring less than 3:1 contrast against the background in light theme. This is an estimate and was not measured. Measure it in a design-system pass.

5. **Low.** Focus is restored through `requestAnimationFrame` and `getElementById`, so it depends on the field ids `${idPrefix}-${key}` staying stable. This includes dotted keys such as `adMultiplier.best`. It is covered only by the tests in #1.

## Missing tests
- The helper tests from finding 1:
  - mode change clears the value (both directions, and no change when the mode stays the same);
  - close-focus target: Escape or Cancel goes to the button; a confirmed reset or a disabled button goes to the first field;
  - roving tabindex.
- Focus after a field reset goes to the input with the expected id, including a dotted key.
- Still open from review 3:
  - calculator component tests;
  - audit rows for `product_pricing`;
  - the `rls.test.ts` cross-workspace `product_id` UPDATE case;
  - AR and 390 px state screens. This round's screenshots are 1280 px only, and light theme was set by editing the `<html>` class, not with the real theme toggle.
