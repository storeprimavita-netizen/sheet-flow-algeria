risk: low · surface: ui · lane: shell

# NAV-2-F — the open lows of NAV-2 review 3

Goal: close the six lows of `NAV-2.review-3.md` and add the crumb render-loop regression test. No migration, no data, query or permission change.

## Done when
- An agent opening `/app/sell/orders/<id>` never reads the "All orders" purpose line: it is their queue's (`navPurpose.confirmation|shipping`). A platform reference still wins, as today.
- Order not found, as an agent: title = queue label, purpose = queue purpose, plus a link back to the queue. As admin: "All orders", link to `/app/sell/orders`.
- Expenses, Ad spend, Accounts have no `related` row (their `FinanceTabs` already link the same pages).
- At 390 px (EN and AR) the record name on a product pricing page is readable; the full name is in a `title` attribute.
- A test fails if setting the same crumb record again produces new state (the round 1 loop).
- Screenshot matrix below taken and fixed; low 5 and low 6 are written down as not changed.

## Facts checked (review paths predate NAV-3)
- Order page is `src/app/(app)/app/sell/orders/[id]/page.tsx`; `role` is already read there; not-found block uses `nav.all` for every role; `orders.notFound` text exists.
- `crumbsFor` already files an agent's order record under their queue, so the crumb half of low 2 is done.
- `related` on money pages: `money/{expenses,ad-spend,accounts}/page.tsx`; all three render `FinanceTabs`. `navigation-ia.md` rule 4 asks for these sibling links; the tabs satisfy it.
- `breadcrumbs.tsx`: non-last items are `shrink-0`, only the last truncates. No `title` anywhere.
- `CONF-4` (claimed:codex) edits the confirmation page and both message files: do not touch that page; expect a mechanical JSON merge.

## Files
1. `src/components/nav-model.tsx` — export `orderHome(role): NavLeaf` (agent → their queue leaf, else the `all` leaf); `crumbsFor` uses it instead of `groups[0]?.items[0]?.href` (null role still yields `[]`).
2. `sell/orders/[id]/page.tsx` — not-found: `nav.<key>`, `purposeKey(leaf)`, `ButtonLink` (outline) to `leaf.href`; found: subtitle fallback `t(purposeKey(leaf))`.
3. `src/messages/{en,ar}.json` — `orders.backToQueue` = "Back to {page}" / "العودة إلى {page}".
4. `money/{expenses,ad-spend,accounts}/page.tsx` — remove the `related` prop.
5. `src/components/breadcrumbs.tsx` — `title={c.label}` on the last item. Screenshot first; if still clipped below `sm`, give the last `li` a minimum width (about 40%) and let earlier ones truncate (`min-w-0`, not `shrink-0`, below `sm`). Logical props only; search modern-web-guidance first.
6. New `src/components/breadcrumb-record.ts` — pure `nextRecord(prev, rec, path)` moved out of `CrumbProvider` (returns `prev` itself when nothing changed); `set` stays `useCallback(…, [])`.
7. `docs/BACKLOG.md` — one line: agent "Show closed" button takes its own row at 390 px (NAV-2 review 3 #6, later UI pass); one line for the review's other missing tests (GroupHub leaf set / redirect / counts, title key = sidebar key).

## Not changed
- Low 5 (group crumb collapses to "…" at 3 parts): matches the NAV-2 brief, the reviewer marks the change optional, and collapsing gives the record name room.

## Steps (each pushed with `scripts/step.sh`)
1. `orderHome` + order page + messages + tests. 2. Remove `related` on money pages. 3. `nextRecord` + test. 4. 390 px truncation fix. 5. Screenshots, fixes, BACKLOG, PROGRESS.

## Tests (by name)
- `nav-model.test`: "orderHome is the role's own queue, All orders for admin".
- New `sell/orders/[id]/not-found-state.test.tsx` (mocks as in `sell/null-profile.test.tsx`): "agent not-found shows the queue title and a back link" (both agent roles), "admin not-found links All orders".
- New `src/components/breadcrumb-record.test.ts`: "same record on the same path returns the previous object", "clearing an empty record returns null unchanged", "a new path or label yields new state".
- Existing crumb tests and gate key parity stay green. No new dependency.

## Screenshots (`docs/design/audit/NAV-2-F/`; dark + light, EN + AR, 1280 + 390)
- Admin: `/app/catalog/products/<id>` and `…/<id>/pricing` (use a long product name), `/app/sell/orders/<id>`, `/app/money/expenses`, `/app/money/accounts`, hubs `/app/sell`, `/app/money`, `/app/catalog`, `/app/team`.
- Confirmation agent: own order, a missing order id. Delivery agent: an inaccessible order id.
- Check no console errors on the record pages. Store preview crumbs only if a store exists in the seed (it did not at review time); say so if skipped.

## Edge cases
- A random UUID and an order outside the role's stage both land on the same not-found state.
- Crumb with record + tail (store preview): the name is not last there; it must not push the bar wider than the screen.
- No new DECISIONS row needed.
