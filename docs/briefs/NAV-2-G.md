risk: low · surface: ui · lane: shell

# NAV-2-G — Arabic crumbs keep their start; the screenshot matrix of NAV-2-F

Goal: close the two mediums of `NAV-2-F.review-2.md` and its three missing tests (D110). No migration, data, query, permission or message-key change.

## Done when
- A truncated Arabic crumb shows its first words, with the ellipsis at its end, in both the EN and AR interface; no `<bdi>` is left inside a `dir="auto"` crumb.
- When a tail ("Preview") follows a record, the tail shows in full and only the record gives way.
- The three tests below pass; `scripts/gate.sh` is OK.
- The matrix is in `docs/design/audit/NAV-2-G/`, what it shows is fixed, and every skip is written in PROGRESS.md.

## Facts checked (code on v3 at claim)
- `src/components/breadcrumbs.tsx:83-90`: `Link` and `span` have `dir="auto"` and wrap the text in `<bdi>`. `dir="auto"` ignores `<bdi>` content, so every crumb computes `ltr`. `[dir]` already isolates, so `<bdi>` is not needed.
- Same file, lines 74-80: the tail is the last `li`, so it is shrinkable and gets `max-sm:min-w-[40%]`; the record before it also shrinks.
- `CrumbRecord` already has `pathname` in its effect deps (line 48); only the test is missing.
- `CrumbRecord` users: order page, product layout, store page, store preview (the only one with a tail).
- Vitest has no DOM: no jsdom or testing-library. Use `renderToStaticMarkup` and mocks (`status-pill.test.tsx`, `mobile-bottom-bar.test.tsx`).
- Effects do not run in static render and `CrumbsContext` is private, so the list markup must be exported to be tested.

## Files
1. `src/components/breadcrumbs.tsx`
   - Remove both `<bdi>` wrappers; keep `dir="auto"` and `title` on the `Link`/`span`.
   - Move the `<ol>` markup into an exported pure `CrumbList({ crumbs, hasTail })` used by `Breadcrumbs`; same output otherwise.
   - Last `li` with `hasTail`: `shrink-0`, no `max-sm:min-w-[40%]` (the 40% stays for a record that is last). Logical classes only.
2. New `src/components/breadcrumbs.test.tsx` — the tests below.
3. `docs/BACKLOG.md` — delete line 61 (NAV-2-F tail `shrink-0`): fixed here, because the row asks for its test.
4. `docs/design/audit/NAV-2-G/` — screenshots. `PROGRESS.md` — note, shots taken, skips.

## Steps (each pushed with `scripts/step.sh`)
1. Remove `<bdi>` + extract `CrumbList` + the no-`<bdi>` test.
2. Tail `shrink-0` + the tail test + BACKLOG line.
3. Re-register test.
4. `scripts/dev-up.sh`, matrix, fixes it shows, PROGRESS, `scripts/dev-down.sh`.

## Tests (by name, `breadcrumbs.test.tsx`)
- "no bdi inside a dir=auto crumb": render `CrumbList` with an Arabic link crumb and an Arabic last crumb; no `<bdi`, both carry `dir="auto"` and `title`.
- "tail keeps its width after a record": with `hasTail`, the last `li` has `shrink-0` and no `min-w-[40%]`; the record `li` has neither `shrink-0` nor `sm:shrink-0`. Without a tail the last `li` keeps the 40%.
- "record re-registers on a path change under a persistent layout": mock `useContext`, `useEffect` (capture fn and deps) and `usePathname`; call `CrumbRecord` on two paths with the same label; deps differ, and running the effect calls `set` with the record.

## Screenshots (EN + AR, dark + light, 1280 + 390; name `<screen>-<lang>-<theme>-<width>.jpeg`)
- Admin: `/app/catalog/products/<id>` and `…/<id>/pricing`, `/app/sell/orders/<id>`, `/app/money/expenses`, `/app/money/accounts`, hubs `/app/sell`, `/app/money`, `/app/catalog`, `/app/team`.
- Admin: `/app/store/pages/<id>` and `…/<id>/preview` (the seed has a store).
- Confirmation agent: own order, a missing order id. Delivery agent: an inaccessible order id.
- Tail sweep on preview: 640, 700, 768 px, EN and AR.
- Long Latin and long Arabic names: substitute the crumb text and `title` in the browser; do not edit the shared local data. Say so in PROGRESS.
- Check the console on the record pages. Users: `scripts/seed-dev.ts`. Use the address on the `UP app` line.

## Edge cases
- At 640-768 px parents are `sm:shrink-0`; with the tail fixed too, the record could shrink to nothing. If the sweep shows less than about 4 characters of the record, let parents shrink up to `md` when there is a tail.
- "#1001" has no strong letter, so `dir="auto"` stays `ltr`, as today. A mixed name follows its first strong letter.
- Search `modern-web-guidance` ("bidirectional text truncation") before the markup change; if unreachable, say so.
- No new DECISIONS row needed. D110 moved the tail low to the backlog; fixing it here only serves the test this row names.
