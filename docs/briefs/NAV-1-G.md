risk: low · surface: ui · lane: shell

# NAV-1-G — drawer name, tabIndex, palette matching, RTL shortcut hint

Goal: close NAV-1-F review-2 lows and two palette polish items (Arabic fuzzy noise, "K⌘" in RTL).

## Definition of done
- Phone drawer dialog name is "Navigation menu" / "قائمة التنقل" (new key `nav.menu`), not "Toggle sidebar"; the toggle button keeps `nav.toggleSidebar`.
- The aside has `tabIndex={-1}` only while the drawer is open (no hidden focus ring at desktop).
- ⌘K filter is substring-based (case-insensitive, diacritics-insensitive for AR), so a short Arabic query matches only labels/groups/old names that contain it; no unrelated rows. Search-forceMount rows still always show.
- Shortcut hint renders "⌘K" / "Ctrl K" in LTR order in AR/RTL, in both the header button and the `?` overlay.
- NAV-1-F brief example fixed (`financeOverview`) — only if the file still says `adSpend`; else skip.
- Gate OK; EN/AR key parity.

## Files
- `src/components/app-shell.tsx`: line ~336 `tabIndex={open && !isDesktop ? -1 : undefined}`; line ~338 `aria-label={t("nav.menu")}`; header `<kbd>` (~421) add `dir="ltr"`.
- `src/components/command-palette.tsx`: both `<kbd>` (`kbdHint`, `?`) get `dir="ltr"`; pass a `filter` to the dialog's `Command` (new optional prop on `CommandDialog`); value stays `${group} ${label}` + keywords.
- `src/components/ui/command.tsx`: `CommandDialog` accepts `filter` and forwards to `<Command loop filter>` (line ~35).
- Filter fn (put in `src/components/nav-model.tsx` or a tiny `palette-filter.ts` so it is unit-testable): normalize both sides (`toLowerCase`, NFKD strip combining marks, strip Arabic tashkeel/tatweel, unify أإآ->ا, ى->ي, ة->ه); score 1 if value or any keyword includes the query, else 0. Return 0 for no match, so cmdk hides it.
- `src/messages/en.json`, `ar.json`: add `nav.menu`.

## Steps (each committed with scripts/step.sh)
1. `nav.menu` key + dialog label + conditional tabIndex.
2. `dir="ltr"` on the three kbd elements.
3. Filter fn + CommandDialog prop + wire in palette.
4. Tests, screenshots, PROGRESS.md note.

## Tests
- `src/lib/nav-model.test.ts` (or new palette-filter test): filter hides non-substrings; Arabic query "طلب" matches orders label only, not unrelated rows; alef/ta-marbuta normalization; `financeOverview` returns 0; old-name keyword matches.
- Source-grep tests as in the existing file: `nav.menu` in both locales; `tabIndex` conditional on `open`; `dir="ltr"` on kbd.
- No DOM test env (D55) — behaviour checked in browser.

## Screenshots (chrome-devtools, EN+AR, dark+light)
- 390 px drawer open (name via a11y snapshot), 1280 px desktop AR header hint reads "⌘K"/"Ctrl K", ⌘K palette AR typing a short query (no noise), EN typing "ad" and an old name.

## Edge cases / notes
- Substring filter loses typo tolerance; acceptable (nav has ~30 rows).
- isDesktop starts true (pre-hydration inert gap) — accepted, harmless, not touched.
- Escape-listener nesting (review-2 low 4) and missing behavioural tests: not in scope; no DOM env.
- No DECISIONS row needed; no migration; no new dependency.
