# STORE-2 brief — stores, store_pages, theme tokens, public product page (read path)
risk: high · surface: ui,security · lane: store

Goal: an admin creates a store and a draft product page in the back office, publishes it, and
`/s/<store>/<page-slug>` renders it publicly from a server-only, cost-free, cached DTO.

## Definition of done
- Tables `stores`, `store_pages` exist with RLS; no anon/authenticated grant on the public path; types regenerated; DB.md updated.
- `/s/<store>/<slug>` renders for a published page, 404 for draft/unknown/other-store; no login needed; no cost field in the DTO (test).
- Publish/unpublish revalidates the cached page (tag) and a change shows without redeploy.
- Store group appears in the nav (Pages, Store settings), admin only; agents get no Store links.
- Page = RTL Arabic, `.store-root` tokens only (no hex in components), 390 px + 1280 px screenshots OK.
- `scripts/gate.sh` green with the live RLS suite (D24).

## Real code found (drift check)
- Latest migration is 00048, so new file = `supabase/migrations/00049_stores_pages.sql`.
- `products` has NO description and `images` is `text[]` of URLs (textarea editor). Description/details live in `store_pages.blocks`, not on products. STORE-1 tables exist (options/values/variants, `loadProductVariants` is session-client, so the public DAL needs its own service-role read).
- `src/lib/supabase/session.ts` only gates `/app` and `/login`, but runs `auth.getUser()` on every request; store routes must skip it (cookies on cached pages).
- `cacheComponents` is OFF in next.config.ts: use `unstable_cache` + tags (read `node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md`, and `revalidateTag` signature in 01-app/.../revalidateTag.md first).
- Nav-model has an empty `groupStore` (`src/components/nav-model.tsx`); empty groups are hidden, so adding items shows it.
- No storage bucket: photos are URLs; S-1 assets (logo, photos) are open, so logo = store name text, blocks without content are hidden, nothing faked.

## Migration 00049 (checklist)
- `stores`: id, workspace_id FK, slug (unique per workspace AND globally unique: it is the public URL key), name, status `draft|live`, `settings` jsonb (phone, whatsapp, instagram, announcement, slogan; zod-validated on write), `theme` text default `luxe-modesty`, created_at/updated_at.
- `store_pages`: id, workspace_id, store_id FK (composite `(id, workspace_id)` style as STORE-1), product_id null FK (same workspace; `unique(store_id, product_id)` where not null), slug (unique per store), title, status `draft|published`, `blocks` jsonb default `[]`, `seo` jsonb, published_at, timestamps; check published needs product_id for product pages.
- RLS enable; `stores` read all roles of the workspace (order sheet shows source), write admin; `store_pages` admin only read and write. UPDATE has USING + WITH CHECK; `workspace_id` immutable trigger; `set_updated_at`; `audit_row()` on both. NO anon grants, revoke from anon.
- `store_domains` is NOT here (STORE-6).

## Files
- `src/lib/store/data.ts` (`server-only`, admin client): `getPublishedPage(store, slug)` returns DTO {store public settings, page blocks, product name/price/compare, images, options+active variants with in-stock flag only}. Explicit column lists, never `select("*")`; wrapped in `unstable_cache` tagged `store:<id>` and `page:<id>`. Zod-parse blocks (`src/lib/store/blocks.ts`: typed block union per theme skill: trust, description, size_guide, service, related; unknown types dropped).
- `src/lib/store/actions.ts` or `src/app/app/store/**/actions.ts`: create store, update settings, create page from product, save blocks (show/hide/reorder), publish/unpublish (+ `revalidateTag`). Re-check admin inside each; zod on every form.
- `src/app/s/[store]/layout.tsx` (`.store-root`, `dir="rtl" lang="ar"`, fonts via next/font: Tajawal, El Messiri first paint; Marcellus, Aref Ruqaa non-blocking), `src/app/s/[store]/[slug]/page.tsx` (+ `generateMetadata` from seo), `not-found.tsx`, `loading.tsx`, `error.tsx`. Chrome: announcement bar, header, footer, WhatsApp float, sticky order bar (anchors to the form slot). Components in `src/components/store/`; tokens in `src/app/s/store-theme.css` copied from skill `references/tokens.css`. Main photo `priority`, 4:5.
- Store has no order form yet: the form block slot renders a hidden/absent state until STORE-3/4 (no dead button; sticky bar hidden until then).
- `src/proxy.ts` / `session.ts`: return `NextResponse.next()` early for `/s/` before `getUser`.
- `src/app/app/store/{page,pages,settings}` + `layout`: stores list/settings, pages list (store, status, last published), page editor (block list, publish). Reuse PageHeader/Empty/Field. Nav items, i18n keys in en.json + ar.json (parity).
- `docs/DB.md` row; `database.types.ts` regen (local only).

## Steps (commit each with scripts/step.sh)
1. Migration 00049 + types regen + DB.md + RLS tests.
2. `src/lib/store/{blocks,data}.ts` + unit/RLS tests.
3. Proxy skip + theme css + layout/fonts/chrome components.
4. Public page route + blocks rendering + 404/loading/error.
5. Back office: actions, store settings, pages list/editor, publish + revalidate, nav, i18n.
6. Screenshots (390/1280, light/dark app; store RTL AR) and PROGRESS note.

## Acceptance tests (names)
- `unpublished page returns 404` · `draft page of another store 404` · `public DTO contains no cost field` (assert key set; product_costs never queried) · `agent cannot read store_pages` · `agent can read stores but not write` · `workspace B admin cannot read workspace A pages` · `anon has no table grant on stores/store_pages` · `publish revalidates tag` (unit, mocked) · `blocks with unknown type dropped` · `slug unique per store` · `store route needs no session cookie`.
- UI: screenshot `/app/store`, pages list, page editor, and `/s/<store>/<slug>` with a long Arabic name, a product with no compare price, one size, no photos; store without announcement.

## Edge cases / assumptions
- Variant stock shown as available/unavailable only (D54: uncounted stock = do not block display).
- Product name emoji stripped on the store (invariant 6); price format Western digits + دج via `format.ts`.
- Prices come from `products.sale_price` for now; per-variant/offer pricing is STORE-3.
- Store slug reserved words (`app`, `api`, `login`) rejected.
- Needs-owner: none new; no DECISIONS row required (D20 covers it). S-1 assets missing only hides blocks.
