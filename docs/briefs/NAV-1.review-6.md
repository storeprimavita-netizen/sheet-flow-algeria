VERDICT: ESCALATE

## Summary
Review 6 is the sixth review of NAV-1's diff (`git diff v3...v3-NAV-1`), checked by ui-reviewer in the browser. D32 and D33 work in the running app. That covers the pinned Settings row, the D33 fades at 1280x720 (bottom fade at the start, gone at the end, none for agents), the active group title as a plain label, a closed group's counter announced with the group name, and the logo not being a link when there is no role.
Two medium findings remain: the phone drawer does not close with Escape and is reachable by Tab while closed, and the palette still searches the internal i18n key. The verdict is ESCALATE because n ≥ 3 without a PASS: the owner decides whether to allow another fix round or to ship and file these as follow-ups.
Screenshots: `docs/design/audit/NAV-1/r9-*.png`. `src/lib/nav-model.test.ts` passes 21 of 21.

## Findings (ranked)

1. **MEDIUM**: `src/components/app-shell.tsx:293-295, 360-361` (phone drawer)
   - **Failure:** at 390x844 (EN, dark) with the drawer open, Escape does not close it; it stays at x=0 (`r9-drawer390-en-dark.png`). The drawer has no dialog role and no focus trap. When it is closed it only moves off screen with `-translate-x-full`, without `inert` or `aria-hidden`, so its 27 links and buttons can still be reached with Tab. Keyboard and screen-reader users land on items they cannot see. This fails cod-ui-polish checklist item 6, "Escape closes overlays".
   - **Fix:** while `open`, add a keydown handler that closes the drawer on Escape. Below `md`, set `inert` on the aside while it is closed. Give the open drawer `role="dialog"` and `aria-modal`, move focus into it when it opens, and send focus back to the toggle when it closes.

2. **MEDIUM**: `src/components/command-palette.tsx:97`
   - **Failure:** D33 limits palette search to page names, old names and group names. `value={`${group} ${label} ${n.key}`}` still includes the internal key. Typing `adSpend` or `financeOverview` (AR, light, 1280) finds the page. The URL is correctly not searchable (`ad-spend` finds nothing).
   - **Fix:** take `n.key` out of the searched `value`. Make the value unique some other way, for example `${group} ${label}`, and keep the href as a React key or a separate id that is not searched.

3. **LOW**: `src/components/app-shell.tsx:~318` (drawer brand link)
   - **Failure:** on the phone it is 32 px high, below the 44 px minimum. Every other drawer row has `max-md:min-h-11`.
   - **Fix:** add `max-md:min-h-11` to the brand link.

4. **LOW**: command palette Arabic matching
   - **Failure:** cmdk's subsequence matching returns noise. "المال" also lists العملاء and المستخدمون والصلاحيات, and "التوصيل" lists Users & roles. This does not break D33.
   - **Fix (optional):** pass a stricter `filter`, such as a word-prefix or substring match.

5. **LOW**: pre-existing, outside the NAV-1 diff
   - **Failure:** the `⌘K` hint in the search button renders as "K⌘" in RTL. Separately, `/app/settings/audit` shows an integration secret (`whsec_…`) in plain text. That page is admin-only.
   - **Fix:** wrap the hint in `<bdi>` or `dir="ltr"`. Mask secrets in the audit view; file this as its own task.

## Missing tests
- **D33 fades:** a behavioural test (jsdom or Playwright) that the bottom fade shows at the start, is gone after scrolling to the end, and never shows for an agent. The current app-shell tests only grep the source.
- **Phone drawer:** a test that Escape closes it, that the aside is `inert` when closed, and that focus goes back to the toggle.
- **Palette search:** a test that the searched `value` contains no i18n key and no href.
- **Row height:** a test that every phone nav row, including the brand link, is at least 44 px.

## Coverage
**Checked in the browser:**
- Admin, AR, light, 1280x720: fades, 21 hrefs all resolve, RTL layout, Settings row highlighted on `/app/settings` and `/app/settings/audit`.
- Admin, EN, dark: active group title is a plain label, closed group counter announcement, focus ring stays visible under the fade.
- Icon rail, AR, light: 4 separators, a single gear, tooltip shows.
- 390 px drawer: EN dark and AR light, including a Settings page.
- confirmation_agent: EN dark and AR light. Sees only Confirmation, no Settings row, no fades; admin routes redirect.
- delivery_agent: EN dark, 390 px drawer. Sees only Shipping.

**Not checked:**
- Numeric contrast ratios (judged by eye only).
- Admin in EN light and in AR dark.
- The rail in dark, and the rail at 390 px.
- The agents' other theme and locale combinations.
