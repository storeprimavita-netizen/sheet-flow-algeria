# Brand facts, budgets and the pre-ship checklist

## Brand facts (seed values for the Luxe Modesty store settings — never hard-code in components)

| Setting | Value |
|---|---|
| Store name | Luxe Modesty (always two words) |
| Phone (display) | 0559 13 85 33 |
| WhatsApp link | `https://wa.me/213559138533` |
| Instagram | @luxemodesty.official |
| Domain | www.luxemodesty.shop |
| Announcement | التوصيل خلال 24 ساعة إلى جميع الولايات · الدفع عند الاستلام |
| Slogans | لَمْ نَصْنَعْ ثَوْبًا.. بَلْ صُغْنَا حِكَايَةَ حُضُورِكِ · تسوق بذكاء، عِش بشكل أفضل |
| About line | أزياء محتشمة راقية للمرأة الجزائرية… |
| Categories | عبايات · قفاطين · جبب · حجابات · بيجامات |
| Default discount code | OFF = 10% |
| Customer service days | السبت–الخميس |

**Wilaya count:** never typed by hand. The store shows the number of wilayas
that have a delivery price in the delivery table (currently 54 of 58 in the
owner's price sheet), so the old "69" in the copy is replaced by that number.

## Speed budget (most customers are on a phone, on mobile data)

- Product page usable before fonts finish: text paints with the fallback, no
  invisible text. Tajawal + El Messiri preloaded; Marcellus + Aref Ruqaa not.
- The main photo is the LCP: priority, explicit width/height (4:5), AVIF/WebP,
  ≤ ~120 KB at 390 px. Every other image lazy.
- The page is server-rendered and cacheable; only the form, gallery and sticky
  bar ship JavaScript. No client-side data fetch is needed to see price and photos.
- No layout shift when the price row, summary or sticky bar updates.
- Third-party scripts (pixels) load after the page is interactive and never
  block the order button.
- Targets on a mid-range phone, throttled 4G: LCP < 2.5 s, CLS < 0.1, and the
  order button responds in < 200 ms. Measure with the browser MCP (Lighthouse)
  and record the numbers in PROGRESS.md.

## Pre-ship checklist

Look and brand
- [ ] Tokens only — no hex / rgb / palette classes in store components.
- [ ] One burgundy button per view; gold only as lines, stars, icons.
- [ ] No emoji in any title, badge, button or product name.
- [ ] Section titles carry the 72px gold rule; photos are 4:5 with 10px radius.
- [ ] Light and dark both correct; text contrast ≥ 4.5:1 in both.

Language
- [ ] `dir="rtl" lang="ar"`; brand name, phone, email, @handle, codes isolated LTR.
- [ ] Feminine address throughout; no machine-translated phrases.
- [ ] Prices `4,900 دج`; saving % recomputed from the two prices; units proofread.
- [ ] Wilaya count, delivery promise and service days match real data.

Form
- [ ] Works one-thumbed at 390 px; no horizontal scroll; tap targets ≥ 44 px.
- [ ] Every pricing mode and offer of this product shows the right total.
- [ ] Phone validation message is specific; first invalid field gets focus.
- [ ] Double tap sends one order; refresh on thank-you sends nothing.
- [ ] Out-of-stock variant cannot be ordered; delivery price appears after wilaya.
- [ ] Keyboard and screen-reader pass: labels, error association, focus ring.

Honesty
- [ ] Only real reviews; no fake urgency; «عرض محدود» only for a real offer.
- [ ] WhatsApp, phone, Instagram and domain come from settings and are correct.

Evidence
- [ ] Screenshots at 390 px and 1280 px, light and dark, saved under
      `docs/design/audit/<task-id>/`, including: long product name, no old
      price, single size, an offer selected, a form error, the thank-you page.
- [ ] Speed numbers recorded.
