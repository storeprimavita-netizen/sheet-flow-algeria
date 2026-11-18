# STORE-2 brief (rev 2, answers review-1 FIX) — stores, store_pages, theme, public product page
risk: high · surface: ui,security · lane: store

Goal: an admin creates a store and a draft product page, publishes it, and `/s/<store>/<slug>` renders it publicly from a server-only, cost-free DTO that is never stale after a change.

## Definition of done
- `stores`, `store_pages` with RLS, strict grants, types regenerated, DB.md row. No anon grant; no authenticated TRUNCATE/TRIGGER/REFERENCES.
- Page renders only when store `status='live'`, page `published`, product `is_active` and `sale_price` not null; else 404 (each tested).
- Every mutation that changes public output calls `updateTag` (read-your-writes) and a `revalidate` of 120 s covers trigger-driven stock; null is never cached.
- `/s` ships `<html lang="ar" dir="rtl">`, no app theme class, no app fonts/Toaster; no Set-Cookie; `/app` auth unchanged.
- Admin-only Store group (Hub, Pages, Settings) with server guard; agents get nothing. Gate green incl. live RLS (D24).

## Drift found
- Latest migration 00048, so `00049_stores_pages.sql`. `products` has no description/compare price, `images` is `text[]`; compare price does not exist: NO "وفّري X%" until STORE-3. Blocks hold description.
- `src/app/layout.tsx` is the one root layout (locale, dark class, fonts, Toaster): split into route groups `(app)` (move existing app, login, auth, etc.) and `(store)/s/...` each with its own root layout. Store locale pinned `ar`, no cookie reads.
- `src/proxy.ts` matcher: add `s/` exclusion to the negative lookahead (exact `s/` segment, not `/settings`). Next 16: `updateTag`/`revalidateTag(tag,'max')` per `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/`; read both first. `cacheComponents` off: `unstable_cache`.
- Service-role read (`admin.ts`) is the only public path; `loadProductVariants` is session-based so DAL has its own.

## Migration 00049 (checklist)
- `stores`: id, workspace_id FK, slug CHECK `^[a-z0-9-]{2,40}$`, unique `lower(slug)` globally, reserved (`app,api,login,s,auth`) rejected by CHECK, name, status draft|live, `settings` jsonb (phone, whatsapp digits, instagram handle, announcement, slogan; NEVER secrets), theme default `luxe-modesty`, timestamps.
- `store_pages`: id, workspace_id, store_id, `kind` text check `product|content`, product_id null (FK `on delete set null (product_id)`, PG15+), slug unique per store, title, status, blocks jsonb `[]`, seo jsonb, published_at; CHECK published and kind=product requires product_id; unique(store_id, product_id).
- RLS: stores read all roles, write admin; store_pages admin only; UPDATE USING+WITH CHECK; workspace_id immutable; set_updated_at; audit_row on both. `revoke all from anon`; revoke truncate/trigger/references from authenticated; new functions revoked from public/anon/authenticated (00046 pattern).

## Files
- `src/lib/store/blocks.ts`: zod block union, `.strict()`, size cap (blocks ≤ 64 KB), text only, no HTML, no `dangerouslySetInnerHTML`. `src/lib/store/settings.ts`: https-only URLs, wa.me built from digits, handle regex, `.strict()`. Also validate `products.images` as https in `products/actions.ts` (`lines()` ~l.74).
- `src/lib/store/data.ts` (`server-only`): zod-check slugs first (bad slug = 404, zero queries). Cache wrapper created per call, keyParts `[store,page]`, tags `store-public`, `store:<slug>`, `page:<store>/<slug>`; revalidate 120; null not cached. Explicit columns. DTO picks listed settings keys only; per variant `{label, inStock:boolean}`; no sku/notes/stock count/variant count/cost. `related` resolves only published pages with same `store_id`.
- Invalidation: `updateTag('store-public')` in product actions (name, price, images, is_active), variant config, stock actions, store settings/status/slug, page save/slug/publish/unpublish (old+new slug on rename).
- Images: plain `<img>` with width/height, 4:5, `fetchPriority="high"` on main only, lazy rest; no `next/image` wildcard. Fonts via `next/font` in store layout: Tajawal 400/500/700, El Messiri 600, Marcellus + Aref Ruqaa `preload:false`, display swap.
- Theme: `src/components/store/theme.css` tokens = `luxe-modesty-store-theme/references/tokens.css` (test diffs); light default, dark via `prefers-color-scheme` with contrast >= 4.5. Chrome: skip link, 44px targets, `<bdi>` on Latin, tabular prices, reduced motion. Hide (not dead-end): header nav, menu button, footer policy links, breadcrumb root, WhatsApp float when no number (icon: Lucide `message-circle`, S-1 asset open); order slot = hidden `#order` anchor. Strings in `store` namespace of en/ar messages. `error.tsx` AR copy + retry, no internals. `noindex` for empty seo.
- App: `/app/store` hub, `/app/store/pages`, `/app/store/pages/[id]`, `/app/store/settings`; layout with admin role check + `notFound`; breadcrumbs, purpose line, Lucide icons; each screen: skeleton, empty (Create store / link to Products), error+retry, populated. Editor: Up/Down aria-labelled buttons, locked blocks as fixed rows, per-block form via `components/fields/*`, dirty indicator, publish disabled with reason, View live + draft preview, confirm on unpublish, link product<->page.

## Steps (each via scripts/step.sh)
1 Migration+types+DB.md+RLS tests · 2 blocks/settings/data + unit tests · 3 route-group split, proxy skip, theme/fonts/chrome · 4 public route + 404/loading/error · 5 actions + invalidation hooks · 6 back-office screens, nav, i18n · 7 screenshots, Lighthouse, PROGRESS.

## Acceptance tests (names)
`unpublished page 404` · `publish after cached 404 shows page` · `unpublish next request 404` · `price/name/is_active/variant stock change shows` · `slug rename old url 404` · `draft store 404` · `inactive product 404` · `page of store A under store B slug 404` · `related id from other store dropped` · `javascript: and http url rejected` · `oversize block rejected` · `bad slug 404 no query` · `public DTO key-set snapshot (nested variants)` · `anon no grant on stores/store_pages` · `functions not executable by anon` · `agent cannot read store_pages / reads stores not write` · `workspace B admin cannot read A` · `s response no Set-Cookie, /app still redirects` · `store components lint no hex/rgb/text-white` · `tokens match skill`.
UI shots: store 390/1280 light+dark (long Arabic name, no photos, one size, no announcement, 404/loading/error, no h-scroll at 390); app 4 screens AR/EN dark/light; mobile Lighthouse; record LCP <2.5s, CLS <0.1, main photo <=120 KB.

## Edge/assumptions
Stock = boolean per D54.4. Emoji stripped from product name on store. Price via `format.ts`, from `sale_price` (STORE-3 adds offers). No new DECISIONS row needed (D20, D54).

## Rev 2 additions (answers review-1; these override rev 1 where they differ)
- M1 locale: store never calls `getLocale`/cookies. Store layout builds `NextIntlClientProvider locale="ar"` from `ar.json` `store` namespace only (statically imported); `i18n/request.ts` untouched. Test: `locale=en` cookie -> `/s` HTML Arabic.
- M2 404: no top-level layout. Add `experimental.globalNotFound` + `src/app/global-not-found.tsx` (neutral, own html/body, read not-found.md first) and `(store)/s/not-found.tsx` (AR copy, noindex).
- M3 move list (git mv): `page.tsx`, `app/`, `login/`, `auth/`, `reset-password/`, `design-preview/`, `globals.css`, `favicon.ico` -> `(app)/`; `api/` stays. Update `algeria-map.test.ts` paths (l.51,76), do not delete. Delete `src/app/layout.tsx` only after `(app)/layout.tsx` is identical. Test: `<html>` attrs, fonts, Toaster for `/login` + `/app/dashboard` AR/EN identical before/after.
- M4 FKs: `unique(id, workspace_id)` on stores; `store_pages` composite FKs `(store_id, workspace_id)` and `(product_id, workspace_id)` (products_id_workspace_uniq exists; set-null column list on product). DAL also asserts one workspace_id. Test `cross-workspace store/product id insert rejected`. Slug CHECK on `store_pages.slug`; `seo` zod schema (L3).
- M5 preview: only `/app/store/pages/[id]/preview` (admin layout, session client, RLS, `force-dynamic`, inside `.store-root`). Test `/s/...?preview=1` draft = 404. No draftMode, no cookie.
- M6 CSS: store has its own `src/components/store/store.css` (`@import "tailwindcss"` + `.store-root` tokens); never imports `globals.css` or `components/ui`. Store `color-scheme: light dark`, `theme-color` per scheme.
- M7 IA: sidebar group "Store"/"المتجر" (Lucide `store`), placed after Catalog; items Hub, Pages, Settings only (no forms/discounts yet). Hidden for agents AND layout 404s; both tested. One store per workspace in UI for now (D20 DB allows many; picker later). "View live" disabled with reason while store draft or page unpublished. i18n: `nav.store`, `store.admin.*`.
- M8 states: `loading.tsx` skeleton = 4:5 block + title + price lines; `error.tsx` AR + retry 44px; empty blocks still render product; no photo = tokenised 4:5 placeholder; alt/title/OG/JSON-LD use emoji-stripped name, fallback page title (unit test).
- L1: null IS cached under the same tags (every publish path calls `updateTag('store-public')`); avoids amplification. Supersedes DoD "null never cached" and test name `publish after cached 404 shows page` proves it.
- L2 DAL drops non-https images. L4 product delete: unpublish its page first in the same action (or clear message). L5/L6: script `store-contrast` checks token pairs both themes; no `fonts.googleapis.com` in store HTML, `adjustFontFallback`, preload budget noted. L7: 390px no h-scroll, `dvh`, safe-area on WhatsApp float with AR aria-label. L8 editor: block types = heading/text/image/list; beforeunload when dirty; failed save keeps input + retry; Up/Down keep focus, aria-live. L10 test proxy `/s/x/y` skipped vs `/app/settings` refreshed.
- Extra tests: `agent sees no Store nav, /app/store 404`, `DAL drops non-https image`, `build smoke each root layout`.
- Needs no new DECISIONS row. S-1 (assets) open: hide WhatsApp icon/logo slots, not a blocker.
