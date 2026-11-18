VERDICT: FIX

## Summary
Brief review 2 (rev 1). qa-reviewer + ui-reviewer, independent. All 7 review-0 highs are fixed or mostly fixed; #1 (null caching) and #5 (layout split) are only partly fixed (see M2, M5, M6, L1).
The (app)/(store) root-layout split is sound in principle, but the brief does not list every route to move, has no plan for 404s without a top-level layout, and does not say what `(app)` must keep. The store locale is not actually pinned: `src/i18n/request.ts` always reads the cookie.
Cross-workspace FKs on `store_pages` are only implied. Draft preview is unspecified. No high findings; the mediums block PASS.

## Findings (ranked)

### Medium
- **M1. The store locale is not really pinned to `ar`.** Brief l.15, l.29; `src/i18n/request.ts:6-9`.
  - Failure: `getRequestConfig` ignores `params.locale` and always reads the `locale` cookie. An admin with `locale=en` who opens `/s/...` gets English strings inside `<html lang="ar" dir="rtl">`, and the page reads a cookie, which breaks the DoD's "no cookie reads".
  - Fix: use `params.locale` when it is valid and fall back to the cookie only when it is not. Or build the store translator straight from the `store` namespace of `ar.json`. Any store client component gets a `NextIntlClientProvider locale="ar"` that carries only the `store` messages.
- **M2. 404s have no top-level layout.** Brief l.15, l.29, l.36.
  - Failure: with two root layouts there is no `src/app/layout.tsx`. Unmatched URLs (`/foo`, `/s/x`, `/s/a/b/c`) and `notFound()` have no `<html>` shell, and nothing exists for them today.
  - Fix: add `experimental.globalNotFound` + `app/global-not-found.tsx` (app-neutral), per `node_modules/next/dist/docs/.../not-found.md`. Add `(store)/s/not-found.tsx` (Arabic copy, store chrome, `noindex`, no Set-Cookie, no app fonts or Toaster).
- **M3. The route move list is incomplete.** Brief l.15, l.35.
  - Failure: the brief says "app, login, auth, etc.", but `src/app/page.tsx`, `reset-password/` and `design-preview/` are not named. Any page left under the top-level `src/app/` has no root layout. The build fails, or the dev server silently writes a new `app/layout.tsx` (`verify-root-layout.js`).
  - Fix: list every path explicitly. Move `page.tsx`, `app/`, `login/`, `auth/`, `reset-password/` and `design-preview/` into `(app)`. `api/` stays (route handlers). Decide where `globals.css` and `favicon.ico` go.
  - `src/components/dashboard/algeria-map.test.ts:51,76` reads `src/app/app/...` by path: update the path, do not delete the test.
- **M4. Cross-workspace FKs on `store_pages`.** Brief l.21.
  - Exploit: with plain FKs, an admin of workspace A inserts a page with `workspace_id=A` and `store_id=<B's store>`. The service-role DAL then renders A's product and price on B's live store.
  - Fix: use composite FKs. `(store_id, workspace_id)` references `stores(id, workspace_id)`, which needs `unique(id, workspace_id)`. `(product_id, workspace_id)` references `products(id, workspace_id)` (`products_id_workspace_uniq` already exists). The DAL also checks that page, store and product share one `workspace_id`.
  - Test: an insert that uses B's store id or product id is rejected.
- **M5. Draft preview is unspecified.** Brief l.30.
  - Failure: done as `/s/...?preview` on the service-role DAL, anyone can read drafts. `draftMode` would set a cookie on `/s`, which breaks "no Set-Cookie".
  - Fix: add an admin-guarded `/app/store/pages/[id]/preview`, loaded through the session client (RLS), rendered inside `.store-root`, and not cacheable.
  - Test: `/s/...?preview=1` returns 404 for a draft page.
- **M6. The brief does not say what `(app)` must keep, or how the store gets its CSS.** Brief l.10, l.28-29, l.37.
  - Failure 1: no acceptance check confirms that `(app)/layout.tsx` still applies the theme cookie (dark default) and the lang/dir from the locale cookie, IBM Plex, the NextIntl provider and the Toaster with no flash.
  - Failure 2: `globals.css:185-195` sets `html{color-scheme:dark}` and the body font. If the store imports it, the light store gets dark form controls and scrollbars.
  - Fix: add a before/after snapshot of the `<html>` attributes for `/login` and `/app/dashboard`, in AR and EN. Give the store its own CSS entry (`@import "tailwindcss"` plus the `.store-root` tokens) that never imports `globals.css` or `components/ui`.
  - Name the app screenshots: `/login`, `/app/dashboard`, `/app/products`, `/app/store`, in dark and light, AR and EN.
- **M7. Admin Store group IA is underspecified.** Brief l.30; `cod-ui-polish/references/navigation-ia.md:28`.
  - Missing: EN/AR sidebar labels, icons, the group's position in the sidebar, and a statement that items for unbuilt features (forms, discounts) are not shown.
  - Missing: a statement that the group is hidden for agents in the sidebar and also guarded by the layout's role check, with both tested.
  - Missing: the first-run flow for 0, 1 and several stores. D20 allows several stores, but the routes have no `[store]` param. Decide on a one-store hub for now, or add a picker.
  - Missing: "View live" must be disabled, with a reason, while the store is draft or the page is unpublished.
- **M8. The public page's four states are underspecified.** Brief l.28-29.
  - Define the `loading.tsx` skeleton (4:5 image block, title line, price line).
  - Define `error.tsx`: Arabic copy, a retry button, 44 px targets.
  - A published page with empty blocks still renders the product (name, price, image).
  - A product with no photo gets a tokenised 4:5 placeholder.
  - `alt`, `<title>`, OG and JSON-LD use the product name with emoji stripped, falling back to the page title when the result is empty. Unit-test this.

### Low
- **L1. "Null not cached" is only possible by throwing inside `unstable_cache`.** Brief l.26.
  - As written, every well-formed but missing slug runs uncached service-role queries (load amplification).
  - Caching null under the same tags is safe, because every publish path calls `updateTag('store-public')`. State which approach the brief takes.
- **L2. Non-https images can still reach the page.** The image check runs only in the action, so existing rows and direct writes skip it. The DAL should also drop non-https image URLs when it reads.
- **L3. Missing DB and schema checks.** `store_pages.slug` has no DB CHECK on its format, and `seo` jsonb has no zod schema.
- **L4. Deleting a product fails with a raw error.** `on delete set null` violates the "published product page needs product_id" CHECK. Unpublish the page in the same step, or map the error to a clear message.
- **L5. Store dark theme contrast has no named check.** Add a script that computes the contrast ratio of each token pair in both themes. Set `color-scheme: light dark` and `theme-color` per scheme.
- **L6. Font weight is unbudgeted.** Four families is heavy for in-app browsers. Set a preloaded-bytes budget, use `adjustFontFallback`, and assert that the store HTML has no `fonts.googleapis.com` link.
- **L7. Mobile checks to add.** At 390 px: no horizontal scroll with a long Arabic name, tap targets of at least 44 px, `dvh` instead of `100vh`, and safe-area padding for the WhatsApp float. The float needs an Arabic accessible name and is hidden when there is no number. State that the thumb check on the order form waits for STORE-3.
- **L8. Editor details.** Brief l.30. Define the block types, the navigate-away behaviour when dirty, and a failed save (reason plus retry, input kept). Up/Down moves keep focus on the moved row and are announced in `aria-live`.
- **L9. Admin i18n.** Name the admin namespaces (`nav.store`, `store.admin.*`). Public prices use `format.ts` with tabular numerals.
- **L10. Proxy matcher.** `(?!s/)` is correct. Test `/s/x/y` (excluded) against `/app/settings` (still refreshed). The bare `/s` still goes through the proxy, which is harmless.

## Missing tests
- With a `locale=en` cookie, the `/s` HTML is Arabic and the page reads no cookie.
- `src/app/layout.tsx` does not exist; `/foo` returns the global 404; `/s/x/y` returns the Arabic store 404 with no app fonts and no Toaster.
- Build smoke: `/`, `/login`, `/reset-password`, `/auth/callback`, `/app/*` and `/s/*` each render under their own root layout, and login still works.
- `<html>` attribute parity for `(app)`: theme class, lang/dir, fonts and Toaster, before and after.
- A cross-workspace `store_id` or `product_id` insert is rejected.
- Draft preview is admin-only; `/s/...?preview=1` returns 404 for a draft.
- The agent sidebar has no Store group, and `/app/store/*` returns 404 for an agent.
- The DAL drops non-https images; emoji are stripped in the title, OG and JSON-LD.
- No horizontal scroll at 390 px (scripted); a contrast script covers both store themes.
