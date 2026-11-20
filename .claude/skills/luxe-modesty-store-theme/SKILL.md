---
name: luxe-modesty-store-theme
description: Use when designing or building any public storefront page for the Luxe Modesty store — product page, order form, variant and offer pickers, collection page, thank-you page, store header/footer, or a store theme/section — so it follows the brand's colours, fonts, Arabic RTL layout, page structure, speed budget and conversion rules. Do NOT use for the back-office app under /app (that is cod-ui-polish).
---

# Luxe Modesty — storefront theme (v2)

Luxe Modesty sells premium modest fashion (abayas, caftans, jubbas, hijabs,
ensembles, pajamas) to Arabic-speaking women in Algeria. Prices in dinars (دج),
cash on delivery, delivery to every wilaya. The look is **burgundy on ivory,
warmed by sand and blush, finished with a thin thread of gold**: calm, feminine,
boutique — never loud, never marketplace-busy.

Scope: **public store pages only.** The back office keeps its own system
(Slate & Emerald, `cod-ui-polish`). Never import app tokens or app components
with app styling into a store page, and never bring burgundy into `/app`.

Reference builds (open and match them when reachable; they need the owner's
login): design system `https://claude.ai/artifact/5ZuUFaQUm6BVbRvmkWNYuh` ·
product page (Orkid caftan) `https://claude.ai/artifact/DQByChoqu5iZQe3MBzi4JL` ·
brand pack `https://claude.ai/artifact/2LmdJaPeL5RKWVgiaaemGM`.
The owner's original skill is kept verbatim in `references/original-v1.md`.

## What v2 adds to the original

1. **The theme is data.** All colours, fonts, radii and shadows live in one
   token file (`references/tokens.css`) scoped to `.store-root`. Components use
   semantic tokens only, so a second store or a seasonal look is a new token
   set, not new components.
2. **Brand facts are settings, not strings in code.** Store name, phone,
   WhatsApp number, Instagram handle, domain, announcement text, slogans and
   the wilaya count come from the store's settings and delivery table. Current
   values are listed in `references/checklist.md` for seeding — do not hard-code
   them in components.
3. **The order form is specified as a dynamic form** — variants, per-variant
   or uniform pricing, quantity offers, delivery price by wilaya and method,
   live summary, every state — in `references/order-form.md`.
4. **Pages are ordered blocks.** Each section is a block with a type and
   content; some are locked in place, the rest can be hidden or reordered per
   product (`references/product-page.md`).
5. **A speed and honesty budget** the page must meet before it ships
   (`references/checklist.md`), plus the thank-you page the original lacked.

## Invariants (a store page that breaks one is not done)

1. **Tokens only.** No hex, `rgb()`, or Tailwind palette colour in a store
   component. If a colour is missing, add a token.
2. **Proportion.** ~60% ivory/white, 25% sand + blush, 10% burgundy + wine, 5%
   gold. Burgundy is for the logo, prices, CTAs and accents — not large
   backgrounds (except the wine announcement bar and footer).
3. **One primary (burgundy) button per view.** Everything else is outline or text.
4. **Gold decorates, it does not speak.** 1px rules, stars, icons. Readable
   gold uses `--gold-text`. Never body text in `--gold`.
5. **Arabic first, RTL, feminine address** (اطلبي، اختاري، املئي، تواصلي، وفّري).
   `dir="rtl" lang="ar"` on the store root; Latin fragments (brand name,
   "Stop desk", phone numbers, emails, @handles, codes) are isolated LTR.
   Never set Arabic in Marcellus.
6. **No emoji anywhere on the store** — not in titles, buttons, badges or
   product names. A product name typed with emoji is displayed without them.
   Icons are thin line icons (1.4–1.6 stroke) in burgundy or gold.
7. **Mobile first.** Designed at 390 px; no horizontal scroll; tap targets
   ≥ 44 px; side gutter ≥ 16 px; grids use `minmax(0,1fr)`.
8. **Numbers are right or absent.** Prices use Western digits, thousands comma
   and دج (`4,900 دج`); the saving % is computed from the two prices; the
   wilaya count comes from the delivery table; units are proofread ("140 سم").
9. **Nothing invented.** Only real reviews, real stock, real deadlines. No
   fake countdowns, no fake "3 people are viewing".
10. **Contrast ≥ 4.5:1 for text in both themes**; focus ring 2px solid
    `--brand` with 2px offset; `prefers-reduced-motion` respected.
11. **The server owns the price.** The page shows what the server computed;
    totals, discounts and delivery fees are never trusted from the browser.

12. **Findable by default.** Every public page is server-rendered with its
    title, description, canonical URL and structured data from real values
    (`references/seo-aieo.md`). No hidden text, no keyword lists.
13. **Offers suggest, they do not trap.** Nothing pre-ticked, a clear "لا شكراً",
    one upsell and at most one downsell (`references/upsell.md`).

## Typography

| Role | Font | Notes |
|---|---|---|
| Brand name, Latin headings, codes, Latin product subtitles | **Marcellus** 400 | One weight — never bold it. Uppercase subtitles: letter-spacing .18em in `--gold-text`. |
| Arabic headings (product title, section titles) | **El Messiri** 600 | |
| Slogans, decorative Arabic lines | **Aref Ruqaa** 700 | Sparingly: hero, packaging, banners. |
| Body, buttons, prices, numbers, forms | **Tajawal** 400/500/700 | Prices 700, `font-variant-numeric: tabular-nums`. |

Scale (mobile → desktop): product title 30→40px, section title 26→32px, price
34px bold, body 16px / line-height 1.7, small 13–14px. Arabic needs a taller
line-height than Latin. Load fonts with `next/font/google` (self-hosted,
`display: swap`, Arabic + Latin subsets): Tajawal and El Messiri are needed for
first paint; Marcellus and Aref Ruqaa must not block it.

## Shape, spacing, depth

- Spacing on a 4px base: 4, 8, 12, 16, 24, 32, 48, 64. Section padding 48–56px;
  card padding 16–20px; grid gaps 12–16px.
- Radius: 4px inputs/badges, 10px cards/photos/form, 999px buttons, chips, size pills.
- One soft shadow only (`--shadow-soft`), on the order form and floating
  elements. Prefer hairline borders.
- Ornament: a 72px × 1px gold rule under each section title. Optional thin
  gold frames. Nothing heavier. No gradients except a very soft blush→sand
  radial behind empty photo slots. No purple/blue, no neon.
- Product photos 4:5 portrait, `object-fit: cover`, radius 10px.

## How to work

1. Read `references/tokens.css` and the reference file for the page you are
   building. Build with those tokens inside a `.store-root` wrapper.
2. Content comes from the product, its variants/offers and the store settings
   — if a section has no content, it is hidden, not filled with placeholder.
3. Verify with your eyes: screenshot at 390 px and 1280 px, light and dark,
   with a long Arabic product name and a product that has no old price, no
   colours and one size. Fix what the screenshots show.
4. Run `references/checklist.md` before calling it done.

## References

- `references/tokens.css` — every token, light and dark, ready to import.
- `references/product-page.md` — store chrome, product page blocks in order, collection page, thank-you page, component specs.
- `references/order-form.md` — the dynamic order form: fields, variants, pricing modes, offers, delivery, summary, validation, states, tracking hooks.
- `references/seo-aieo.md` — what every public page carries for Google and for AI assistants: head tags, structured data, quotable facts, site files.
- `references/upsell.md` — order bump, cross-sell, mix bundles, post-order upsell and downsell: layout and the no-pressure rules.
- `references/checklist.md` — brand facts to seed, speed budget, pre-ship checklist.
- `references/original-v1.md` — the owner's original skill, unchanged.
