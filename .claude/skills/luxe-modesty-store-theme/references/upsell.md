# Bumps, cross-sell, mix bundles, upsell, downsell — how they look

Spec: `docs/specs/GROW.md` §4. Same tokens, same calm tone as the rest of the
store: an offer is a suggestion from a boutique, never a pop-up trap.

- **Order bump** (inside the order form, above the summary): one card with a
  checkbox, 56px photo, name, struck normal price and the offer price in
  burgundy. Unticked by default. Ticking updates the summary at once.
- **Cross-sell "أكملي إطلالتك"** (under the form or after the description):
  up to 3 product cards, each with "أضيفي" (outline button) and its own
  size/colour pickers when needed.
- **Mix bundle "طقم"**: one card listing the pieces with small photos, the
  bundle price and the saving in دج (computed); each piece gets its picker.
- **Upsell** (thank-you page, under the order summary, once): gold rule, a
  title such as "عرض خاص لطلبكِ", one product with photo, struck price and
  offer price, a burgundy pill "أضيفيه إلى طلبي" and a plain text link
  "لا شكراً" of equal visibility (≥ 44px tall, `--ink-muted`, underlined).
- **Downsell**: replaces the upsell card only after "لا شكراً" — same layout,
  smaller offer. After a second no, the card disappears for good.
- Accepting shows the updated order total in place and a `--success` line
  "تمت الإضافة إلى طلبكِ"; no second form, no retyping.
- Rules: nothing pre-ticked; no countdown unless a real deadline exists in the
  offer's settings; no modal that blocks the thank-you message; one primary
  (burgundy) button per view still holds — on the thank-you page it is the
  upsell button only when an offer is shown.
