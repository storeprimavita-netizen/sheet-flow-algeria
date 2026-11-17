---
name: luxe-modesty-store-theme
description: Use when designing or building any Luxe Modesty store page, product page, theme, section or storefront UI, so it follows the brand's colours, fonts, RTL Arabic layout and product-page structure.
---

# Luxe Modesty — store theme & product page

Luxe Modesty sells premium modest fashion (abayas, caftans, jubbas, hijabs, ensembles, pajamas) to Arabic-speaking women in Algeria. Prices in dinars (دج), cash on delivery, delivery to every wilaya. The look is **burgundy on ivory, warmed by sand and blush, finished with a thin thread of gold**: calm, feminine, boutique — never loud, never marketplace-busy.

Reference builds (open and match them when available):
- Design system: https://claude.ai/artifact/5ZuUFaQUm6BVbRvmkWNYuh
- Product page (Orkid caftan): https://claude.ai/artifact/DQByChoqu5iZQe3MBzi4JL
- Brand pack (logo files, colours, fonts): https://claude.ai/artifact/2LmdJaPeL5RKWVgiaaemGM

## 1. Colour tokens

Define every colour as a CSS variable; never hard-code colours in components.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--surface-100` | #FAF6F0 ivory | #1C1013 | Page background |
| `--surface-200` | #FFFFFF | #29181C | Cards, form, inputs |
| `--surface-300` | #EFE4D6 sand | #33201F | Section bands |
| `--blush` | #F3E3E1 | #4B2C31 | Soft highlight areas, saving badge |
| `--ink` | #2B1519 | #F5ECE6 | Body text |
| `--ink-muted` | #6E5A57 | #C2AEAA | Secondary text, old prices |
| `--brand` | #5D1728 burgundy | #E3A3AE | Heading accents, prices, links |
| `--brand-fill` | #5D1728 | #7A2338 | Primary buttons, selected size |
| `--brand-fill-hover` | #3D0F1B wine | #8C2C43 | Hover |
| `--on-brand` | #FFFFFF | #F5ECE6 | Text on brand fill |
| `--wine` | #3D0F1B | #3D0F1B | Announcement bar, footer |
| `--rose` | #8C3A4C | #A34A5E | "عرض محدود" / sale badges |
| `--gold` | #A88350 | #D4B07A | Hairlines, stars, icons (decoration only) |
| `--gold-text` | #7D5F33 | #D4B07A | Gold when it must be read as text |
| `--line` | #E6D8CA | #4A3034 | Dividers, card borders |
| `--line-strong` | #8F7A74 | #8A6F72 | Input and chip borders |
| `--success` | #2F6B4F | #7CC4A0 | Valid code, confirmed |
| `--danger` | #B3471D | #F0946B | Errors (orange-red so it never looks like the brand) |

Rules:
- Proportion: ~60% ivory/white, 25% sand + blush, 10% burgundy + wine, 5% gold.
- One primary (burgundy) button per view. Burgundy is for the logo, prices, CTAs and accents — not big backgrounds (except the wine footer/announcement bar).
- Gold is for 1px lines, stars and icons. Never body text in plain `--gold`.
- Text contrast ≥ 4.5:1 in both themes. Focus ring: 2px solid burgundy (rose-pink in dark), 2px offset.
- No gradients except a very soft blush→sand radial behind empty photo slots. No purple/blue, no neon, no emoji in headings or buttons.

## 2. Typography (all free on Google Fonts)

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Aref+Ruqaa:wght@400;700&family=El+Messiri:wght@500;600;700&family=Marcellus&family=Tajawal:wght@400;500;700&display=swap">
```

| Role | Font | Notes |
|---|---|---|
| Brand name, Latin headings, codes (OFF), Latin product subtitles | **Marcellus** 400 | One weight only — never bold it. Uppercase subtitles get letter-spacing .18em in `--gold-text`. |
| Arabic headings (product title, section titles) | **El Messiri** 600 | |
| Slogans, decorative Arabic lines | **Aref Ruqaa** 700 | Use sparingly (hero, packaging, banners). |
| Body, buttons, prices, numbers, forms | **Tajawal** 400/500/700 | Prices 700. Use `font-variant-numeric: tabular-nums` for prices and tables. |

Scale (mobile → desktop): product title 30→40px, section title 26→32px, price 34px bold, body 16px / line-height 1.7, small 13–14px. Arabic needs taller line-height than Latin. Never set Arabic in Marcellus.

## 3. Shape, spacing, depth

- Spacing on a 4px base: 4, 8, 12, 16, 24, 32, 48, 64. Section padding 48–56px; card padding 16–20px; grid gaps 12–16px.
- Radius: 4px inputs/badges, 10px cards/photos/form, 999px buttons, chips, size pills.
- Shadows: one soft shadow only (`0 6px 24px rgba(93,23,40,.08)`) on the order form and floating elements. Prefer hairline borders.
- Ornament: a 72px × 1px gold rule under each section title. Optional thin gold frames. Nothing heavier.
- Product photos 4:5 portrait, `object-fit: cover`, radius 10px.

## 4. Language & direction

- `dir="rtl" lang="ar"` on the page. Latin text (brand name, "Stop desk", phone numbers, emails, @handles) wrapped so it stays LTR (`direction:ltr; unicode-bidi:isolate`).
- Speak to the customer in the feminine: اطلبي، اختاري، املئي، تواصلي، وفّري.
- Prices: Western digits + thousands comma + دج → `4,900 دج`. Old price struck through in `--ink-muted`. Saving badge: `وفّري 51%` (compute it correctly from the two prices).
- Phone format: `0559 13 85 33`. Validation: starts 05/06/07, 10 digits.
- The name is always **Luxe Modesty** (two words). No emoji in titles ("🌸 قفطان أوركيد 🌸" becomes "قفطان أوركيد").
- Proofread units ("140 سم", not "1.40 سم") and keep the wilaya count consistent everywhere (site says 69).

## 5. Global store chrome

1. **Announcement bar** — `--wine` background, white 14px centered: "التوصيل خلال 24 ساعة إلى جميع الولايات · الدفع عند الاستلام".
2. **Header** — sticky, ivory, bottom hairline. Right: logo symbol (40px, burgundy) + "Luxe Modesty" in Marcellus 22px. Left: nav الرئيسية · المتجر · من نحن · اتصل بنا (active item burgundy with 2px underline). Hide nav under 720px.
3. **Footer** — `--wine` background; three columns: logo + one-line about ("أزياء محتشمة راقية للمرأة الجزائرية…"), policies (الخصوصية، الاسترجاع، شروط الخدمة) under gold headings, contact (phone, email, Instagram @luxemodesty.official). Copyright line under a gold hairline.
4. **Floating WhatsApp** — 56px burgundy circle bottom-left with the white WhatsApp icon (official icon file supplied by the brand), linking to `https://wa.me/213559138533`.
5. **Sticky bottom order bar** (product pages) — white bar: product name + price/old price on the right, burgundy pill "اطلبي الآن" on the left, scrolls to the form. Respect `env(safe-area-inset-bottom)`.

## 6. Product page — order of sections

Keep this order (it matches the live store's flow):

1. Breadcrumb (13px muted): الرئيسية / المتجر / [category] / [product].
2. **Top block** — two columns on desktop (gallery right in RTL, buy column left), one column on phones with the gallery first.
   - **Gallery:** large 4:5 main photo + row of 5 thumbnails; selected thumb has a burgundy border.
   - **Buy column:**
     - Badges: "عرض محدود" (rose fill, white text) + perk badge e.g. "حزام مجاني" (gold outline, gold-text).
     - Title in El Messiri + Latin name under it in Marcellus uppercase gold (e.g. ORKID CAFTAN).
     - Rating: gold ★★★★★ + 5.0 + "(6 تقييمات)" linking to reviews.
     - Price row: big burgundy price, struck old price, blush "وفّري X%" pill.
     - Perks list with small gold line icons (free gift, 100% guarantee "مطابق للفيديو والصور").
     - **Size** pills (38–50), selected = burgundy fill; "دليل المقاسات" link to the size table.
     - Colour swatches if the product has colours (round 32px, burgundy ring when selected).
     - **Quantity** stepper in a pill (− 1 +).
3. **Order form card** (white, 10px radius, soft shadow) directly in the buy column — this is the conversion point:
   - Title "اطلبي الآن" + lead "املئي معلوماتك وسنتصل بك لتأكيد الطلب."
   - Fields: الاسم الكامل · رقم الهاتف · الولاية (select, numbered "16 - الجزائر") · البلدية · العنوان (اختياري).
   - Delivery method: two selectable cards — "إلى المنزل" / "إلى مكتب التوصيل (Stop desk)" with price once known.
   - Discount code input (dashed border) + outline button "تطبيق". Code **OFF** = 10% off; show success in `--success`, errors in `--danger` with how to fix.
   - Summary: سعر المنتج · التوصيل · الخصم · **المجموع** (burgundy, bold, top hairline).
   - Full-width burgundy pill CTA: "اطلبي الآن" + small "الدفع عند الاستلام".
   - Inline field errors in Arabic under each field; never a browser alert.
4. **Trust band** (sand): 3 items with burgundy line icons — ضمان الجودة · توصيل إلى 69 ولاية · الدفع عند الاستلام.
5. **Description** (ivory): two columns — "عن القطعة" (short paragraph + bullet benefits: fabric, embroidery, comfort, occasions, gift idea) and "التفاصيل" as a definition list (القماش، الطول، المقاسات، مع الطلب).
6. **Size guide** (sand): table in a white rounded container (scrolls horizontally on phones): المقاس · يناسب · الكتفين · الصدر · الخصر · الوزن التقريبي; note on how measurements are taken.
7. **Reviews** (ivory): big "5.0" score + stars + count; 3-column cards (2 on tablet, 1 on phone) with name, stars, "✓ طلب مؤكد", real review text and date; "عرض المزيد" outline button. Only real reviews — never invent review text.
8. **Service strip** (sand): 4 items with a gold top hairline — توصيل سريع · استبدال وإرجاع · خدمة الزبائن (السبت–الخميس) · الدفع عند الاستلام.
9. **Related products** (ivory): "قد يعجبك أيضاً", 3 cards (2 per row on phones): 4:5 photo, name, price in burgundy, struck old price if any.
10. Footer, sticky order bar, WhatsApp button.

## 7. Collection / store page

- Same chrome. Hero band in blush/sand with an El Messiri title and one Aref Ruqaa slogan line (e.g. "لَمْ نَصْنَعْ ثَوْبًا.. بَلْ صُغْنَا حِكَايَةَ حُضُورِكِ" or "تسوق بذكاء، عِش بشكل أفضل"), one burgundy CTA "اكتشفي الآن".
- Category chips (pills, burgundy when active): الكل · عبايات · قفاطين · جبب · حجابات · بيجامات.
- Product grid: 2 columns phone, 3 tablet, 4 desktop; same card as related products plus optional rose "-X%" badge top-right of the photo.
- Then trust band, a short about block, FAQ accordion (طرق الدفع، الإلغاء، مدة التوصيل، الإرسال), footer.

## 8. Components quick spec

- **Primary button:** `--brand-fill`, `--on-brand`, Tajawal 700 16–18px, pill, 14–15px × 22px padding, hover `--brand-fill-hover`.
- **Secondary button:** transparent, 1px `--brand` border, `--brand` text, pill.
- **Inputs:** `--surface-100` fill, 1px `--line-strong`, 4px radius, min-height 46px; invalid → `--danger` border + message.
- **Chips/pills:** 1px `--line-strong`, 44px tall touch target; selected = burgundy fill or burgundy inset ring.
- **Cards:** `--surface-200`, 1px `--line`, 10px radius, no shadow.
- **Icons:** thin line icons (1.4–1.6 stroke) in burgundy or gold; Material Symbols Outlined weight 300 is acceptable. No emoji.

## 9. Responsive & quality checklist

- Mobile first (most customers shop on phones). Test at 390px: no horizontal scroll; every grid uses `minmax(0,1fr)` so long Arabic text can't push columns wider.
- Side gutter ≥16px; tap targets ≥44px.
- Both light and dark themes from the token table.
- Images: 4:5, lazy-loaded, descriptive Arabic alt text.
- Before shipping: prices and discount % correct, wilaya count consistent, units correct, no emoji in titles, all text in feminine address, WhatsApp/phone/Instagram correct (0559 13 85 33, @luxemodesty.official, www.luxemodesty.shop).
