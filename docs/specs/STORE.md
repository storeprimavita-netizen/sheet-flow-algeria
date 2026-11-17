# STORE — native storefront

Goal: sell from our own store pages instead of Lightfunnels/Shopify; orders
land directly in the platform. Supersedes plan item P1-4. Look and behaviour of
every public page: skill `luxe-modesty-store-theme`. Lightfunnels and Shopify
webhooks stay as inert incoming integrations (D6).

## Model

- `stores`: workspace_id, slug, name, status, `settings` jsonb (phone,
  WhatsApp, Instagram, announcement, slogans, policies), `theme` (token set
  key), default page template. One workspace may own several stores.
- `store_domains`: store_id, hostname, verified_at. v1 serves a store at
  `/s/<store>/…`; a custom domain maps to it in `src/proxy.ts` by Host header.
- `product_options` (product_id, name: size/colour/…, position) and
  `product_option_values` (label, swatch token or image, position).
- `product_variants`: one row per sellable combination — option value ids,
  sku, stock, `price_override`, `compare_at_override`, is_active. Replaces
  `products.variants` jsonb; stock moves per variant (orders get `variant_id`).
- `product_pricing_mode`: `uniform` ("keep all the same" ticked — one price) ·
  `per_value` (a value adds/sets a price) · `per_variant` (each combination).
- `offers`: product_id, kind `quantity` (N pieces for total T, optional free
  delivery / gift) · `bump` (add-on product at a price) ; label, position,
  is_default, active window.
- `product_forms`: product_id, fields jsonb (which fields, required, extra
  custom fields), delivery methods allowed, discount codes enabled.
- `store_pages`: store_id, product_id null for collection/home/policy pages,
  slug, status `draft|published`, blocks jsonb (ordered, typed — the block
  list in the theme skill), seo, published_at.
- `discount_codes`: store_id, code, percent|amount, limits, window, products.
- `checkout_sessions`: abandoned-checkout capture — store, page, valid phone,
  name, wilaya, selection, tracking ids, status `open|converted|contacted`.
- `reviews`: product_id, name, rating, text, order_id null, approved — only
  approved reviews render; none are generated.

All tables: workspace_id + RLS (admin write; agents read what the order sheet
needs — never costs). **No anon grants.**

## Public side (risk high, surface security)

- Read: `src/lib/store/data.ts`, `server-only`, service role, returns
  published-only DTOs (no costs, no internal notes, no unpublished pages).
  Pages are server-rendered and cached; revalidate on publish. Check the Next
  16 caching docs before choosing the mechanism.
- **Order submit** `POST /api/store/order`: zod-validated body = page id,
  variant ids, offer id, quantity, customer fields, delivery type, code,
  idempotency key, tracking ids. The server recomputes price, offer, discount
  and delivery fee from the database — **client totals are ignored**. One
  transaction: upsert customer by normalized phone → insert order
  (`source = 'store'`, store_id, page_id, variant_id, utm/landing) → existing
  triggers flag duplicates and history. Stock is checked at submit, decremented
  on confirmation as today.
- Abuse: idempotency key unique per form load; per-IP and per-phone rate limit;
  honeypot + minimum fill time; optional captcha setting; blocked phones
  (CONF) rejected politely; body size cap; `proxy.ts` must not require a
  session for store routes.
- The response is the server-computed summary + order public id for the
  thank-you page; never internal ids of other records.

## Back office (Store group)

- **Pages**: list by store, status, last published; editor = block list with
  per-block form, live preview at 390 px and desktop, publish/unpublish.
- **Forms & offers** (also on the product page): options and values, the
  pricing-mode switch (tick "same price for all" or fill the per-value /
  per-variant grid), offers editor with computed saving, form fields editor.
  A preview shows the form exactly as the store renders it.
- **Discounts**, **Abandoned checkouts** (list → one click creates an order in
  the confirmation queue or marks contacted), **Store settings**.

## Tasks

STORE-1 variants model + migration of `products.variants` + per-variant stock
(lane db, risk high) · STORE-2 stores, pages, theme tokens, public product
page read path · STORE-3 options/pricing modes/offers/forms editor + public
form rendering · STORE-4 order submit endpoint (risk high) + thank-you page ·
STORE-5 discount codes + abandoned checkouts · STORE-6 collection/home page,
policies, custom domain · STORE-7 reviews + size guide blocks.

## Acceptance (named tests the briefs must include)

Price tampering (client sends a lower total → server total wins) · replay with
the same idempotency key → one order · unpublished page → 404 · DTO contains
no cost field · rate limit hit → 429 without a row · out-of-stock variant →
rejected · duplicate window still flags · agent session cannot read
`discount_codes` or `checkout_sessions` money fields.
