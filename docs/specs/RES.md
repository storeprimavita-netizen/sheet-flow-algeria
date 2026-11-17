# RES — product research ("products we spy on")

Goal: one place to collect products seen elsewhere, compare them, price them
with the calculator, decide what to test, and turn a validated product into a
real product with an empty store page ready to fill. Admin-only (it holds
supplier prices and margins).

## Data

`research_products`: workspace_id, name, category (`options` set
`product_category`, emoji allowed), source_url, seen_at (store / ad / supplier
name), images[] (Supabase Storage, admin-only bucket), competitor_price_dzd,
competitor_offer (free text: "2 for 5,900"), supplier_price + currency + fx,
est_ad_cost_usd, ad_links[] (ad-library / TikTok URLs), notes, tags,
status, validated_stock_qty, product_id (set when promoted), created_by.

Status pipeline (system statuses, through `lib/statuses.ts`):

```
idea → to_test → testing → validated → live
                    └──────→ rejected (with a reason option)
```

- `to_test`: owner decided to try it. `testing`: a sample/test batch exists.
- `validated` **requires a stock entry** (quantity + cost) — "get a stock of
  that product validated". The transition asks for it and refuses without.
- `live`: promoted.

## Screens (Catalog → Research)

- Board by status (kanban) by default; table toggle; filters by category,
  price band, margin band, tag. Card: image, name, competitor price, our
  suggested price, estimated margin, status.
- Detail sheet: all fields, image gallery, the calculator (PRICE) embedded
  with supplier price → product cost, showing suggested price and margin in
  the three scenarios next to the competitor's price.
- Quick add: paste a URL + name + price; everything else optional.

## Promote (validated → live)

One action, one transaction:
1. create `products` row (name, category, images, status `to_be_tested`) and
   `product_costs` from the validated stock entry; first `stock_movements`
   purchase for the validated quantity;
2. copy pricing inputs into `product_pricing`; set the sale price to the
   suggested price (editable before confirming);
3. create a **draft** store page from the store's default template
   (STORE.md) with the product's name, images and price filled and every
   content block empty — the owner then writes the copy;
4. link `research_products.product_id`; status `live`.

Nothing is published automatically.

## Rules

- No scraping in v1: entries are typed or pasted by the team. (Automated
  price tracking of competitor pages is an idea in IDEAS.md, not a task.)
- Images are uploaded files, not hot-linked competitor URLs.

## Tasks

RES-1 table + RLS + board/table + quick add (lane db) · RES-2 detail sheet
with embedded calculator (after PRICE-2) · RES-3 validate-with-stock + promote
(after STORE-2; risk high: stock and cost writes).
