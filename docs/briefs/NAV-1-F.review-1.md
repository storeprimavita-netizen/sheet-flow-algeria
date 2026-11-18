VERDICT: FIX

## Summary
Browser-checked by ui-reviewer (chrome-devtools, admin seed). Palette key fix, inert closed drawer, Escape close + focus return,
Radix menu Escape isolation, resize-close and the 44 px brand row all work. One medium blocks: the drawer declares
`aria-modal="true"` but does not contain focus and leaves the page behind it reachable. Remaining items are low.
The screenshot matrix is still incomplete (see "Not verified").

## Findings (ranked)

1. **Medium — `src/components/app-shell.tsx:326` (aria-modal) + `:181-194` (focus effect) + `:413` (`<main>`)**
   Failure: at 390 px with the drawer open, Shift+Tab from the aside goes to BODY and then to elements of the page behind it.
   `<main>` and the header are not inert, so screen readers still read the background while the drawer claims to be modal.
   Fix: while `open && !isDesktop`, set `inert` on the content column (header + `<main>`), or trap Tab inside the drawer.
   Check that the overlay/scrim click also closes the drawer.

2. **Low — `src/components/app-shell.tsx:326`** — the dialog's accessible name is `nav.toggleSidebar` ("Toggle sidebar" /
   "تبديل الشريط الجانبي"), which names the button, not the menu. The brief chose this to avoid adding i18n keys. A better name is a
   `nav.menu` key ("Navigation menu" / "قائمة التنقل") in both en and ar. Optional now; fine to file as a follow-up.

3. **Low — `src/components/command-palette.tsx:97`** — typing `adSpend` still shows "Ad spend" through cmdk's fuzzy match on the
   label. The key is no longer in `value` (`financeOverview` returns nothing), so the fix is correct. The DoD example is wrong,
   not the code; use `financeOverview` as the example from now on.

4. **Low — toggle focus ring** — after Escape the ring is visible but faint (a 1 px box-shadow at about 55% alpha). Consider the
   standard `focus-visible` ring token.

5. **Low (dev only)** — the Next dev badge overlaps the avatar in the open drawer. Not a production issue.

## Missing tests
- `src/lib/nav-model.test.ts` only greps the source. Nothing tests the behaviour: Escape closes the drawer, focus returns to the
  toggle, `inert` toggles at < md, the drawer closes on resize to >= md.
- No test that the background is inert or focus is contained while the drawer is open (this would catch finding 1).
- No test that Escape inside the user-menu dropdown closes only the dropdown.

## Not verified
- The ui-reviewer never pressed Tab against the closed drawer. It confirmed `inert=true` and that the drawer is absent from the
  a11y tree.
- Matrix gaps: EN light, AR dark, 1280 in AR and in light, and the closed drawer in EN and in dark. Verified: AR light 390
  (open, closed, user menu), EN dark 390 (open), EN dark 1280.
- Screenshots: `docs/design/audit/NAV-1-F/`.
