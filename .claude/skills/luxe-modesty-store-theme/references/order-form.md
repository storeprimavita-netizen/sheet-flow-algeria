# The order form — the conversion point

A white card (`--surface-200`, 10px radius, `--shadow-soft`) in the buy column.
Everything a product needs is configured per product in the back office
(`docs/specs/STORE.md`); this file says how each configuration must look and
behave. The form renders whatever the product's form definition contains —
nothing here is hard-coded to one product.

## Layout, top to bottom

1. Title «اطلبي الآن» + lead «املئي معلوماتك وسنتصل بك لتأكيد الطلب.»
2. Variant pickers (when the product has variants)
3. Offer picker (when the product has quantity offers)
4. Quantity stepper (hidden when an offer fixes the quantity)
5. Customer fields
6. Delivery method
7. Discount code (when enabled for the store)
8. Summary
9. CTA + reassurance line

On phones the variant, offer and quantity pickers sit directly above the
customer fields so the whole order is one scroll.

## Variant pickers

- **Size:** pills (e.g. 38–50), 44px tall, selected = burgundy fill; a
  «دليل المقاسات» link scrolls to the size-guide block.
- **Colour:** round 32px swatches with the colour name as accessible text and
  shown beside the label when selected; burgundy ring when selected.
- **Any other option** (length, fabric…): pills.
- A combination that is out of stock is visibly unavailable and cannot be
  selected; if a whole value is out, it says «غير متوفر».
- When the product has one size and no colours, no picker is shown.
- Nothing is pre-selected when more than one choice exists — the CTA asks for
  the missing choice («اختاري المقاس») and scrolls to it.

## Pricing modes (set per product in the back office)

| Mode | What the customer sees |
|---|---|
| Same price for all variants ("keep all the same" ticked) | One price in the price row; pickers do not change it |
| Price per option value (e.g. a colour or a size costs more) | Price row updates on selection; a pill may show «+500 دج» in `--ink-muted` |
| Price per combination | Price row updates on selection; before a full selection it shows «ابتداءً من X دج» |

The old price and the «وفّري X%» pill follow the selected variant. If a
variant has no old price, the pill and the struck price disappear — never a
0% or negative saving.

## Offers (quantity bundles)

Selectable cards, one per offer, radio behaviour, the best-value one may carry
a gold-outline «الأكثر طلباً» badge only if it is true:

```
( ) قطعة واحدة                    4,900 دج
(•) قطعتان — وفّري 800 دج         9,000 دج     توصيل مجاني
( ) ثلاث قطع — وفّري 1,800 دج    12,900 دج     توصيل مجاني
```

- Each card: quantity label, saving in DZD (computed), total, optional perk
  (free delivery, free gift).
- When the offer is for N pieces and the product has variants, show N variant
  rows («القطعة 1», «القطعة 2») so each piece gets its size/colour; a «نفس
  المقاس واللون» toggle fills them all.
- Selecting an offer updates the summary immediately.

## Customer fields

| Field | Rules |
|---|---|
| الاسم الكامل | `autocomplete="name"`, required |
| رقم الهاتف | `inputmode="tel"`, `autocomplete="tel"`, isolated LTR; valid = 10 digits starting 05/06/07; shown formatted `0559 13 85 33` after blur |
| الولاية | searchable select, numbered «16 - الجزائر», from the delivery table; a wilaya the store does not ship to is absent |
| البلدية | select filtered by wilaya; for stop-desk delivery it becomes the list of desks in that wilaya |
| العنوان | optional unless the product form marks it required; hidden for stop-desk |
| Extra fields | any field the product form defines (note, second phone, measurements) rendered with the same input component |

Labels are always visible above the field. Errors appear under the field in
Arabic, in `--danger`, saying what to fix («رقم الهاتف يجب أن يبدأ بـ 05 أو 06
أو 07 ويتكوّن من 10 أرقام»); never a browser alert, never only a red border.
Validate on blur and on submit; on submit, focus the first invalid field.

## Delivery method

Two selectable cards — «إلى المنزل» / «إلى مكتب التوصيل (Stop desk)» — each
showing its price once the wilaya is known («اختاري الولاية لمعرفة السعر»
before). A method unavailable for that wilaya is hidden. Free delivery shows
«مجاني» in `--success`, with the normal price struck.

## Discount code

Dashed-border input + outline button «تطبيق». Valid → a line in `--success`
with what it did («تم تطبيق خصم 10%»); invalid → `--danger` with the reason
(expired, not for this product, minimum not reached). The code is validated by
the server; the browser never computes the discount.

## Summary

```
سعر المنتج            9,000 دج
التوصيل                  600 دج
الخصم                  − 900 دج
─────────────────────────────
المجموع               8,700 دج     ← burgundy, bold, top hairline
```

Tabular numerals, amounts at the end side. Rows with a zero value are hidden
except delivery (which shows «مجاني»). The summary is what the server returned
for the current selection; while it refreshes, the total shows a skeleton,
not a stale number.

## CTA and states

- Full-width burgundy pill «اطلبي الآن» + small «الدفع عند الاستلام» under it.
- **Submitting:** button disabled, keeps width, «جارٍ الإرسال…»; a double tap
  cannot create two orders (one idempotency key per form load).
- **Success:** go to the thank-you page.
- **Failure (network/server):** message above the CTA in `--danger` with what
  to do («تعذّر إرسال الطلب، حاولي مرة أخرى أو تواصلي معنا عبر واتساب»);
  everything typed stays.
- **Out of stock while ordering:** say which piece and keep the form.
- **Already ordered** (same phone + product very recently): a calm notice
  «لقد استلمنا طلبكِ، سنتصل بكِ قريباً» instead of a second order.

## Hooks the form must expose (wired by the tracking task, not styled here)

Events are emitted once each with the ids the tracking spec defines:
viewing the product, first interaction with the form, choosing a variant or
offer, and a successful order. A phone number typed but not submitted may be
saved as an abandoned checkout only after it is a valid number — say so in
the store's privacy policy. See `docs/specs/TRACK.md` and `docs/specs/STORE.md`.
