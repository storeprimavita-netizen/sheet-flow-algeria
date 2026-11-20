# SEO and AIEO — what every public page must carry

Spec: `docs/specs/GROW.md` §3. This file is the builder's checklist.

**Head (server-rendered, never injected by client JS)**
- `<html lang="ar" dir="rtl">`; unique `<title>` (≤ 60 characters: product +
  one benefit + store name), meta description (≤ 155, says price in دج and
  "الدفع عند الاستلام"), canonical URL, Open Graph + Twitter card with the main
  4:5 photo, French `hreflang` alternate when a French version exists.

**Structured data (one JSON-LD script, values from the database)**
- Product page: `Product` (name, description, image[], sku, brand) with
  `Offer` (price, `priceCurrency: "DZD"`, availability from real stock,
  `acceptedPaymentMethod` cash on delivery, `areaServed: "DZ"`,
  `shippingDetails` when the fee is known), `AggregateRating` + `Review` only
  from approved real reviews, `BreadcrumbList`.
- Store home: `OnlineStore`/`Organization` (name, logo, telephone, sameAs).
- FAQ block: `FAQPage`. Never mark up content that is not visible on the page.

**Content that search engines and AI assistants can quote**
- One `<h1>` (the product title), section titles as `<h2>`, real text — not
  text baked into images.
- A short facts block in plain sentences: what it is, fabric, sizes, price,
  delivery time and price range, payment on delivery, return policy.
- Arabic first; add the French name and the Darija/Latin spellings customers
  type ("caftan", "قفطان", "kaftan") naturally in the text, not as a keyword list.
- Every image has descriptive Arabic alt text; decorative images have `alt=""`.

**Site files**
- `/sitemap.xml` (published pages, lastmod, images), `/robots.txt`,
  `/llms.txt` (store summary for AI assistants), product feed for Google
  Merchant Center and Meta catalogue. Unpublished pages return 404 and are in
  none of them.

**Never**
- Hidden text, keyword stuffing, fake reviews or ratings, doorway pages,
  different content for crawlers than for people. These get a store removed
  from results.

**Check before shipping**: view-source shows title, description, canonical
and JSON-LD; the JSON-LD validates (no missing price/availability); Lighthouse
SEO ≥ 95; page works with JavaScript off for reading and for the order form.
