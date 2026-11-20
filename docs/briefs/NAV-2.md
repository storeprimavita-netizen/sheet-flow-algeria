risk: low · surface: ui · lane: shell

# NAV-2 — Where-am-I: breadcrumb, title, purpose line, group hubs

Goal: every `/app` page shows breadcrumb (top bar) + title = sidebar label + a purpose line, and each group root is a real hub page, not a silent redirect.

## Done when
- Top bar shows `Group › Page › Record` on every `/app/**` page, each part a link except the last; RTL chevrons flip; en + ar.
- `PageHeader.subtitle` is required (type error without it); the 3 headers lacking it get one (`products/new`, `contacts/suppliers/new`, `orders/new`; `orders/[id]` first header at line 46 too).
- Page titles equal sidebar labels (reuse `nav.*` keys; no "Delivery" vs "Shipping" drift).
- Hubs exist: `/app/sell`, `/app/catalog`, `/app/money`, `/app/team`, `/app/store` (exists), `/app/settings` (exists, keep). Each lists the role-visible leaves with purpose line (+ live count where cheap: confirmation/delivery/tasks counters already exist).
- Related-links row (max 3) on Expenses/Ad spend/Accounts, Stock/Products, Confirmation/Shipping, Research(pricing)/Pricing.
- No data, action or permission changes (spec rule). No route moves (NAV-3).

## Facts found in code
- Header lives in `src/components/app-shell.tsx` ~l.412 (sticky h-14; has toggle, palette, brand). No breadcrumb yet; only `store/_components/crumbs.tsx` (store admin, root "Store") — fold into the shared one, keep its callers working or migrate them.
- `src/components/nav-model.tsx`: GROUPS/HOME, `activeLeafHref`, `visibleNav(role)`; groups have no href yet. `src/components/page-header.tsx` subtitle is optional; 35 call sites, 4 miss it.
- Pages with no PageHeader: `products/[id]/*` (header in `layout.tsx` with product name, no title/purpose), `store/pages/[id]/preview`. Redirect-only: `team/page.tsx`, `finance/page.tsx`, `orders/page.tsx` (role redirect — leave; NAV-3 redirects it), `products/planner`.
- Agents' nav is only their queue; hubs and breadcrumbs must use `visibleNav(role)` so no link to a refused page. Agent crumb root `/app/sell` hub must show only their leaf (or redirect straight to it if one leaf).

## Files
1. `src/components/nav-model.tsx` — add `href` to each group (`/app/sell|catalog|store|money|team|settings`); add `purposeKey` per leaf (i18n `navPurpose.<key>`); export `crumbsFor(role, pathname)` → `[{labelKey, href?}]` (group, leaf by `activeLeafHref`, then trailing static segment `new`/record).
2. `src/lib/nav-model.test.ts` — extend (see tests).
3. `src/components/breadcrumbs.tsx` (client, uses `usePathname`, `useTranslations`) + render in app-shell header after the palette; hide on Home; truncate on 390 px (show last two parts, group collapses to `…`). `<CrumbRecord label>` optional context so `[id]` pages supply the record name; fallback `t("nav.record")`-free: show nothing for the tail.
4. `src/components/page-header.tsx` — `subtitle` required; optional `related?: {href,label}[]` (max 3, typed tuple) rendered as small link row.
5. Hub pages: `src/app/(app)/app/{sell,catalog,money}/page.tsx`, replace `team/page.tsx` redirect; shared `src/components/group-hub.tsx` (grid of Links: icon, label, purpose, optional count). Read `visibleNav` via `getProfile`; counts via existing counters source (check app-shell/layout for how counts load; reuse, no new query).
6. Callers: add subtitles to the 4 missing headers; `related` on the pairs above; product layout h1 gets breadcrumb Catalog › Products › {name} (via CrumbRecord).
7. `src/messages/{en,ar}.json` — `navPurpose.*` for every leaf, hub copy, `nav.breadcrumb`, new-page subtitles. One plain sentence each; parity gate.
8. `command-palette`: add the five hub pages? Not required; skip.

## Steps (each pushed)
1. nav-model hrefs/purposeKey + crumbsFor + tests. 2. messages. 3. Breadcrumbs in shell. 4. PageHeader required + fill gaps + related links. 5. Hubs. 6. Replace store Crumbs with shared. 7. Screenshots + PROGRESS.

## Tests (by name)
- `nav-model.test`: "crumbsFor admin /app/finance/expenses → Money › Expenses", "agent never gets an admin crumb or hub item", "every leaf has purposeKey present in en and ar", "detail path /app/orders/<id> → Sell › All orders".
- Gate key parity covers messages. tsc enforces required subtitle.

## Screenshots (light+dark, EN+AR, 1280 + 390)
Hub `/app/money` and `/app/sell` (admin) and `/app/sell` as confirmation agent; `/app/finance/expenses` with related links; `/app/orders/<id>` and `/app/products/<id>` (record tail); `/app/orders/new`; 390 px breadcrumb overflow.

## Edge cases / assumptions
- Orders detail (`orders/[id]`) maps to leaf "all" via `match`; products sub-tabs map to Products.
- `/app/store` hub already exists (storeHub leaf) — keep, just make sure breadcrumb root links to it.
- Hub URLs `/app/sell` etc. are new canonical and survive NAV-3; `/app/finance` stays a redirect until NAV-3 (do not turn into hub; Money hub is `/app/money`).
- Settings hub is the current tabbed page; do not rebuild.
- No new DECISIONS row needed.
