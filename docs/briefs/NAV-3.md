risk: low · surface: ui · lane: shell

# NAV-3 — Canonical URLs, permanent redirects, one Courier cash surface

Goal: every `/app` page lives at its canonical URL from `navigation-ia.md`, every old URL 308-redirects, and Orders→Cash + Finance→Income become one Money → Courier cash page; no data, action or permission change.

## Done when
- Canonical URLs serve (see map); nav-model hrefs, crumbs, palette, `revalidatePath`, `redirect()`, query-string drill links (`/app/orders/all?…`) and all `<Link>`s point only at new URLs (grep for old prefixes returns nothing outside `next.config.ts`).
- `next.config.ts` `redirects()` (permanent: true) covers every old path incl. dynamic ones, preserving query strings (Next does by default) — e.g. `/app/orders/:id`.
- `/app/money/courier-cash` is one page, tabs via `?tab=collections|income` (default collections); old `/app/orders/cash` and `/app/finance/income` redirect there (`?tab=income`). Nav loses the separate `income` leaf (en+ar keys kept only if used).
- Agent: no new link to refused pages; old `/app/orders` role-redirect and `/app/finance`, `/app/team` redirects still land correctly.
- Gate green; screenshots clean.

## Map (old → new)
`/app/orders/confirmation`→`/app/sell/confirmation` · `/orders/delivery`→`/sell/shipping` · `/orders/all`→`/sell/orders` · `/orders/new`→`/sell/orders/new` · `/orders/:id`→`/sell/orders/:id` · `/orders` (role redirect page)→ keep as redirect to `/app/sell/...` · `/contacts`→`/sell/customers`, `/contacts/:id`→`/sell/customers/:id` · `/contacts/suppliers[/…]`→`/money/suppliers[/…]` · `/products[/…]`→`/catalog/products[/…]` · `/stock`→`/catalog/stock` · `/pricing` and `/products/planner`→`/catalog/pricing` · `/finance/{overview,accounts,expenses,ad-spend}`→`/money/*` · `/finance`→`/money` · `/orders/cash`, `/finance/income`→`/money/courier-cash`. Unchanged: dashboard, statistics, store/*, team/*, settings/*.

## Facts found in code
- Folders map 1:1 to URLs today; hubs `sell|catalog|money/page.tsx` exist (NAV-2). `orders/` root holds shared `actions.ts`, `order-form`, `order-tabs`, `_lib`, 3 tests; `finance/` holds `layout`, `finance-tabs`, `finance-filter-bar`; cash has own `actions.ts` + `layout.tsx` (admin guard).
- ~74 files reference old prefixes (grep `/app/(orders|contacts|products|stock|finance|pricing)`); `revalidatePath` ×71; tests in `src/lib/{nav-model,query-string,cash}.test.ts`, `admin-guard-layout.test.tsx`, `document-title.test.ts`.
- `/research` leaf does not exist yet (RES-1); do NOT create it. Table's planner→research is stale: planner already redirects to Pricing.
- Existing `[...rest]` catch-all 404s unmatched `/app/**`; redirects in next.config run before it.
- Docs: Next 16 `redirects` in `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/redirects.md`; `:path*` supported.

## Steps (git mv, fix imports + links, tsc, commit+push each)
1. next.config `redirects()` table for ALL moves + a unit test reading it. 2. Sell: orders/*, contacts→customers (mv, imports, nav-model, links, revalidatePath). 3. Catalog: products, stock, pricing. 4. Money: finance/*, suppliers. 5. Courier cash merge (tabs, delete income leaf, redirects). 6. Cleanup: grep old prefixes, palette, query-string helpers, `docs/DB.md`/refs if they list routes. 7. Screenshots + PROGRESS.
Note: redirect source entries must exist before the folder is removed (step 1 first).

## Tests (by name)
- `next-config-redirects.test`: "every old URL maps to a canonical one, permanent", "no redirect chain (destination never matches another source)", "dynamic ids and suppliers/new covered".
- `nav-model.test`: update hrefs; "no nav href uses an old prefix"; "agent leaves unchanged".
- Existing order/cash/query-string/admin-guard tests pass after path updates (not weakened).

## Screenshots (light+dark, EN+AR, 1280+390)
Sidebar active state on each moved page; `/app/money/courier-cash` both tabs; `/app/sell/orders/<id>`; `/app/catalog/products/<id>` tabs; agent `/app/sell/confirmation`; open an old URL (bookmark) and show it lands.

## Edge cases / assumptions
- "Merge" = one page with two tabs, each keeping its current queries/actions untouched (Income is per-product P&L, Collections is cash ledger); they are not blended. Assumption stays within NAV rule "no behaviour change" — no DECISIONS row needed.
- Server actions' hidden IDs/forms unaffected by path moves; `revalidatePath` must target new paths or caches go stale.
- Auth-redirect `next=` params and email links (invites/reset) may hold old paths: redirects cover them.
- Webhook/carrier/store code does not reference these routes (grep confirmed outside src/app: none).
