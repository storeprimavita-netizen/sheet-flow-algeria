VERDICT: FIX

## Summary
Brief review (qa-reviewer with owasp-security, plus ui-reviewer; static, no app run).
Main gaps: the cache tag design can't work as written, so a cached 404 stays forever and prices go stale. The
root layout wraps `/s/`, so the store can't set `<html lang="ar" dir="rtl">`. The DTO ignores store status and
product `is_active`. Store-content XSS is possible on the app origin. App UI states and the editor are underspecified.
All of these can be fixed in the brief; no owner decision is needed.

## Findings

### HIGH
1. **Cache tags/keys can't be built as specified** (brief Files › data.ts). `unstable_cache` tags are fixed when the wrapper is created, but the lookup only has `(storeSlug, pageSlug)`, so the `store:<id>`/`page:<id>` tags need an uncached lookup first. A null (404) result is also cached under the slug with no tag, and `revalidate` defaults to false. Failure: visit a draft page (404 gets cached), publish it, and the page stays 404 forever. Fix: create the wrapper per call with keyParts `[storeSlug, pageSlug]`, slug-based tags plus a coarse `store-public` tag. Don't cache null, or give it a short `revalidate`. On a slug rename, invalidate both the old and the new tag.
2. **Not every mutation that changes public output invalidates the cache** (brief Files › actions; DoD). Only publish/unpublish revalidate. These also change the page:
   - product name, `sale_price`, images and `is_active` (`src/app/app/products/actions.ts:97-203` uses `revalidatePath` only)
   - `save_variant_config` and stock movements/counts
   - store settings, status and slug
   - page blocks, seo and slug
   - stock changes made by DB triggers (order status changes, carrier sync)

   Failure: a stale public price or in-stock flag, which breaks "the server owns the price". Fix: call `updateTag('store-public')` (or the matching tags) in every one of those actions. Add a time-based `revalidate` of 60–300 s to cover the trigger-driven stock changes.
3. **Unpublish uses stale-while-revalidate.** `revalidateTag(tag,'max')` still serves the stale page to the next visitor. Fix: use `updateTag` in server actions (read the Next 16 docs). Test: unpublish, and the very next request returns 404.
4. **Draft store / inactive product still renders** (DTO spec). `stores.status` and `products.is_active` are not filtered. Fix: require `stores.status='live'`, `products.is_active` and a non-null `sale_price`. Add a test for each.
5. **The root layout wraps `/s/`** (`src/app/layout.tsx:21-41`). The store inherits the app locale, `dir`, the `dark` theme class (`color-scheme: dark`), the render-blocking IBM Plex stylesheet, the app messages provider and the Toaster. A nested layout can't set `<html lang dir>`. Fix: split into route groups `(app)` and `(store)`, each with its own root layout. Pin the store locale to `ar` without reading cookies, so the page stays cacheable. Test that `/s` ships `<html lang="ar" dir="rtl">` with no app class or fonts.
6. **Store dark/light theme is unspecified.** The skill requires both themes to be correct at ≥4.5:1 contrast, and the tokens include dark values. Fix: state that light is the default and how dark is applied (`prefers-color-scheme` or a class). Add dark screenshots and a contrast check to step 6.
7. **Images and fonts** (step 3). Photos are external URLs (`text[]`), so `next/image` needs `remotePatterns`. A `**` wildcard turns the optimizer into an open proxy (SSRF), and unknown hosts break the LCP image. Fix: use a strict host allow-list, or a plain `<img>` with width/height, `fetchpriority="high"`, 4:5 and `object-fit:cover`. Next 16 deprecates `priority`; use `preload`/`fetchPriority`. Fonts:
   - `next/font` with `display:'swap'` and subsets arabic+latin
   - Tajawal 400/500/700 and El Messiri 600 only
   - Marcellus and Aref Ruqaa with `preload:false`
   - fonts scoped to the store layout

   Record measured budgets in PROGRESS: LCP < 2.5 s on throttled 4G, CLS < 0.1, main photo ≤ ~120 KB.

### MEDIUM
8. **XSS on the app origin.** Store pages share the origin with `/app`. Values that reach the page:
   - settings links (instagram, whatsapp)
   - `products.images` (`lines()` at `actions.ts:74` doesn't validate URLs)
   - block text
   - JSON-LD/metadata

   Fix: in zod, allow https URLs only and build the `wa.me` link from digits only. Check the Instagram handle against a pattern. Make the settings schema `.strict()`. Validate blocks on write and cap their size. Render all content as text and never use `dangerouslySetInnerHTML`. Escape `<` in JSON-LD. Test that a `javascript:` URL is rejected on write.
9. **The related block can leak data across workspaces.** The service role resolves ids from the `blocks` jsonb without RLS. Fix: resolve only published pages whose `store_id` matches the current page's store. Test that an id from another store or workspace is dropped.
10. **The cross-store test is too weak.** "Draft page of another store 404" passes even if the `store_id` filter is missing. Add: a published page of store A requested under store B's slug returns 404.
11. **The DTO leaks fields, and the brief has a factual error.** Pick only the listed `settings` keys; never return the jsonb whole. Never expose `notes`, `sku`, the stock count or the variant count; in-stock should be a boolean per D54.4. `compare` does not exist on `products`: define where the compare price comes from, and show "وفّري X%" only when compare > sale. Add a DTO key-set snapshot test that includes the nested variants.
12. **Slug format and cache growth.** Add a DB CHECK `^[a-z0-9-]{2,40}$`, a unique index on `lower(slug)` and reserved slugs. Zod-check the slug before any DB or cache call. Test that a bad slug returns 404 without a query.
13. **App IA and routes are ambiguous.** "stores list/settings" at `/app/store` conflicts with navigation-ia, where group roots are real hub pages. Fix:
    - URLs: hub at `/app/store`, list at `/app/store/pages`, editor at `/app/store/pages/[id]`, settings at `/app/store/settings`
    - breadcrumbs, a purpose line, and titles equal to the sidebar labels in EN/AR
    - Lucide icons
    - a server-side admin guard (role check + `notFound`), not only hidden nav
14. **The page editor is underspecified.**
    - Show/hide and reorder with keyboard-accessible Up/Down buttons that have aria labels.
    - Locked blocks shown as fixed rows.
    - A content form per block type using `components/fields/*`.
    - A dirty/save indicator.
    - Publish disabled, with a reason, when there is no product or price.
    - A "View live page" link and a draft preview.
    - Confirm or undo on unpublish.
    - Links between the product and its page.
15. **The app screens don't list their four states.** For the hub, list, editor and settings, add:
    - a loading skeleton
    - empty states with an action ("Create store"; "no products" links to Catalog › Products)
    - an error state with a reason and retry
    - the populated state

    Store `error.tsx` should have Arabic copy and a retry, and must not leak internals.
16. **Store chrome must not dead-end.**
    - Render the order slot as a stable `#order` anchor that stays hidden for now.
    - Hide the WhatsApp float when there is no number.
    - Don't render header nav, footer policy links or the breadcrumb "المتجر" while they have no destination.
    - No menu button when there is no nav.
    - The WhatsApp icon (brand asset missing, S-1): state the fallback (Lucide `message-circle`, or hide the float).

### LOW
17. **`store_pages.product_id`.** "Published needs product_id for product pages" has no `kind` column to test against. Also, a composite FK with `on delete set null` would null `workspace_id` too. Fix: add `kind`, and use `on delete restrict` or `set null (product_id)` (PG ≥15).
18. **Grants.** Default ACLs give anon and authenticated full privileges on new tables (TRUNCATE/TRIGGER included; verified locally). Revoke all from anon. Revoke TRUNCATE/TRIGGER/REFERENCES from authenticated. Revoke execute on new functions from public/anon/authenticated (the 00046 pattern).
19. **Proxy skip.** Match `/s/` exactly, not the `/s` prefix (which would also match e.g. `/settings`). Better: exclude it in the `src/proxy.ts:12` matcher. Test that a `/s/` response has no `Set-Cookie` and that `/app` still redirects when there is no session.
20. **Settings are readable by agents** (stores are visible to all roles). Never put secrets (pixel tokens, captcha keys) in `stores.settings`.
21. **SEO.** `generateMetadata` falls back to the product name when seo is empty. Apply noindex where relevant.
22. **i18n.** Put the store page strings in messages (or a store AR dictionary covered by the parity gate). Wrap Latin fragments (store name, phone, @handle) in `<bdi>`/`dir="ltr"`. Use tabular numerals for prices.
23. **Accessibility.** 44 px tap targets, a skip link, alt text from the product name, keyboard-operable gallery thumbnails, a 2 px `--brand` focus ring, and `prefers-reduced-motion`.

## Missing tests / checks
- Publish after a cached draft 404 shows the page. Unpublish gives 404 on the next request.
- Changes to product price, name or `is_active`, or to a variant's stock, show on the public page.
- After a page slug rename, the old URL returns 404.
- A draft store returns 404. An inactive product returns 404.
- A published page of store A under store B's slug returns 404.
- A related-block id from another store or workspace is dropped.
- Settings with a `javascript:` or http URL are rejected. A block over the size cap is rejected.
- A bad slug format returns 404 without a query.
- New functions are not executable by anon. anon has no privileges on `stores`/`store_pages`.
- DTO key-set snapshot (nested variants included) with no cost, sku or stock count.
- A `/s` response has no `Set-Cookie`. `/app` auth is unchanged.
- Lint `src/components/store/**` for hex, `rgb()`, palette colors and `text-white`/`bg-white`. Diff the token file against the skill's `references/tokens.css`.
- Screenshots:
  - store at 390/1280 in light and dark, plus edge cases: long Arabic name, no compare price, one size, no photos, no announcement, 404/loading/error, and no horizontal scroll at 390 px
  - app screens in AR and EN, dark and light
  - a mobile Lighthouse run, with numbers recorded
