# Store pages — chrome, product page, collection, thank-you

Text in «…» is a default; the real text comes from store settings or the
product. A block with no content is hidden.

## Global store chrome

1. **Announcement bar** — `--wine` background, `--on-brand` 14px centred.
   Default «التوصيل خلال 24 ساعة إلى جميع الولايات · الدفع عند الاستلام».
   Only promise a delivery time the carrier data supports.
2. **Header** — sticky, ivory, bottom hairline. Start side (right in RTL): logo
   symbol (40px, burgundy) + store name in Marcellus 22px, isolated LTR. End
   side: nav الرئيسية · المتجر · من نحن · اتصل بنا (active item burgundy with a
   2px underline). Under 720px the nav hides behind a menu button (44px).
3. **Footer** — `--wine` background; three columns: logo + one-line about;
   policies (الخصوصية، الاسترجاع، شروط الخدمة) under gold headings; contact
   (phone, email, Instagram). Copyright under a gold hairline. One column on phones.
4. **Floating WhatsApp** — 56px burgundy circle, bottom-left, white official
   WhatsApp icon (brand-supplied file), links to `https://wa.me/<number>` from
   settings. Sits above the sticky order bar, never over it.
5. **Sticky bottom order bar** (product pages) — `--surface-200` bar: product
   name + price / old price at the start, burgundy pill «اطلبي الآن» at the end;
   scrolls to the form and focuses the first empty field. Hidden while the form
   is on screen. Respects `env(safe-area-inset-bottom)`.

## Product page — blocks in order

`locked` blocks always render in this position. Others are optional and may be
hidden or reordered per product in the page editor.

| # | Block | Band | Locked | Content |
|---|---|---|---|---|
| 1 | Breadcrumb | ivory | yes | 13px muted: الرئيسية / المتجر / category / product |
| 2 | **Top block** (gallery + buy column) | ivory | yes | below |
| 3 | **Order form** | card in buy column | yes | `order-form.md` |
| 4 | Trust band | sand | no | 3 items, burgundy line icons: ضمان الجودة · توصيل إلى N ولاية · الدفع عند الاستلام |
| 5 | Description | ivory | no | two columns: «عن القطعة» (short paragraph + bullet benefits) and «التفاصيل» as a definition list (القماش، الطول، المقاسات، مع الطلب) |
| 6 | Size guide | sand | no | table in a white rounded container, scrolls horizontally on phones: المقاس · يناسب · الكتفين · الصدر · الخصر · الوزن التقريبي; a note on how measurements are taken |
| 7 | Reviews | ivory | no | big score + stars + count; cards 3 / 2 / 1 columns: name, stars, «✓ طلب مؤكد», text, date; «عرض المزيد» outline button |
| 8 | Service strip | sand | no | 4 items under a gold top hairline: توصيل سريع · استبدال وإرجاع · خدمة الزبائن · الدفع عند الاستلام |
| 9 | Related products | ivory | no | «قد يعجبك أيضاً», 3 cards (2 per row on phones) |
| 10 | Footer · sticky order bar · WhatsApp | – | yes | chrome |

Bands alternate ivory / sand; if hiding a block puts two same-colour bands
together, that is fine — do not invent a filler.

### Top block

Two columns on desktop (gallery at the start side, buy column at the end), one
column on phones with the gallery first.

- **Gallery:** large 4:5 main photo + a row of up to 5 thumbnails; the selected
  thumb has a burgundy border. Swipe on touch, arrow keys on keyboard. The main
  photo is the page's LCP image: priority-loaded, sized, never lazy. Selecting
  a colour switches to that colour's first photo.
- **Buy column, top to bottom:**
  - Badges: «عرض محدود» (rose fill, `--on-brand`) only when a real limited
    offer exists; perk badge e.g. «حزام مجاني» (gold outline, `--gold-text`).
  - Title in El Messiri; Latin name under it in Marcellus uppercase
    `--gold-text` (e.g. ORKID CAFTAN) when the product has one.
  - Rating: gold stars + score + «(6 تقييمات)» linking to the reviews block.
    Hidden when there are no reviews.
  - Price row: big burgundy price · struck old price in `--ink-muted` · blush
    «وفّري X%» pill. The row updates when the variant or offer changes.
  - Perks list with small gold line icons (free gift, guarantee «مطابق للفيديو والصور»).
  - Variant pickers, offer picker, quantity — see `order-form.md`.
  - The order form card.

## Collection / store home

- Same chrome. Hero band in blush/sand: El Messiri title, one Aref Ruqaa
  slogan line, one burgundy CTA «اكتشفي الآن». No carousel.
- Category chips (pills, burgundy when active): الكل + the store's categories.
  The active chip is in the URL.
- Product grid: 2 columns phone, 3 tablet, 4 desktop. Card: 4:5 photo, name,
  price in burgundy, struck old price if any, optional rose «-X%» badge at the
  top start corner of the photo. Whole card is one link.
- Then trust band, a short about block, FAQ accordion (طرق الدفع، الإلغاء،
  مدة التوصيل، الإرسال), footer.
- States: loading = card skeletons in the same grid; empty category = a calm
  line + link to الكل; error = message + retry.

## Thank-you page (after a successful order)

- Gold rule, El Messiri «شكراً لكِ، تم استلام طلبكِ», then one sentence on what
  happens next: «سنتصل بكِ على الرقم <phone> لتأكيد الطلب».
- Order summary card: product, variant, quantity, delivery method, total.
- One secondary action: «تواصلي معنا عبر واتساب». Optional related products.
- No second order form, no pressure copy. The page is reachable once per
  order (refresh must not submit again or fire the purchase event twice).

## Components

- **Primary button:** `--brand-fill`, `--on-brand`, Tajawal 700 16–18px, pill,
  padding 14–15px × 22px, hover `--brand-fill-hover`, disabled 50% opacity
  with a visible reason nearby. Loading keeps its width and shows a small
  spinner + «جارٍ الإرسال…».
- **Secondary button:** transparent, 1px `--brand` border, `--brand` text, pill.
- **Inputs:** `--surface-100` fill, 1px `--line-strong`, 4px radius, min-height
  46px, visible label above (never placeholder-only); invalid → `--danger`
  border + message under the field.
- **Chips / pills:** 1px `--line-strong`, 44px tall; selected = burgundy fill
  or burgundy inset ring; unavailable = muted with a diagonal hairline and
  `aria-disabled`.
- **Cards:** `--surface-200`, 1px `--line`, 10px radius, no shadow.
- **Badges:** 4px radius, 13px, rose fill or gold outline as above.
- **Icons:** thin line (1.4–1.6 stroke) in burgundy or gold; decorative icons
  are `aria-hidden`.
