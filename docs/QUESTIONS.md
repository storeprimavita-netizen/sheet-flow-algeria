# Questions for the owner

The loop writes here when a task needs something only the owner can decide or
provide. Other work continues meanwhile. Answer in the session, or write the
answer under the question and it is picked up at the start of the next run.
What Claude decided by itself is in `docs/DECISIONS.md` ("Decided by Claude —
owner may overturn").

## Open

### Q-9 · PRICE-1 · 2026-11-18 · answered-by-default
When the profit is asked as a percentage of the product's cost, what is the
highest percentage the calculator should accept? **Applied by default (D52):**
1000%. Above that the price shows "—" instead of a number, so typing a wrong
value can never produce a huge price that looks real. Example on benz: 65% →
5,200 DZD; 1000% → 22,500 DZD; anything higher → "—". Say so if you ever
use more than 1000% (it is one number to change). Also applied: a product that
is 100% of the store's sales is accepted. Nothing is blocked.

### Q-8 · PRICE-1 · 2026-11-18 · answered-by-default
In the calculator you can ask for a profit as a percentage instead of a fixed
amount ("cost + 60–70%"). A percentage of what? **Applied by default (D51):**
of the product's own cost per piece. Example on benz at 65%: product cost 1,813
→ profit 1,179 per piece → suggested price 5,200 (ads, returns and fees are
still fully covered on top). The other reading, 65% of the total cost per piece
(product + ads + returns + fees = 3,885), gives profit 2,525 and a suggested
price of 6,600. Say so if you meant the total cost. The default stays the fixed
profit (1,500 DZD → 5,500), unchanged. Nothing is blocked.

### Q-7 · P0-8 · 2026-11-18 · answered-by-default
When you delete an order, should its pieces go back into stock? **Applied by
default (D41):** only if the piece never left the warehouse (not yet handed to
the carrier, cancelled, or already returned), or if the order was the new order
of a swap (the piece goes back to the first order). A deleted order that was
delivered or is still with the carrier keeps its pieces out of stock; if that
parcel comes back, add a correction line on the product's stock page. Say so if
you want every deleted order to put its pieces back. Same rule for the new
order of a swap (D42): if it was already with the carrier when deleted, its
piece stays out until it physically comes back. Nothing is blocked.

### Q-6 · P0-8 · 2026-11-18 · answered-by-default
Between confirmation and handing the parcel to the carrier, the piece is still
in your warehouse. **Applied by default (D34):** it stays *in stock* but is
shown as *reserved*, so the same piece is not sold twice. It becomes *on road*
when the carrier takes it. Say so if you want it counted as on road from
confirmation instead.

### Q-3 · P0-8 · 2026-11-18 · answered-by-default
Some older orders had their stock counted under the earlier rules (taken off at
delivery instead of at confirmation, or never given back after a cancel).
**Applied by default (D29):** nothing is recounted in bulk. Stock already
recorded for an old order is treated as done, and stock only moves when that
order's status, quantity or product changes — editing a note never changes
stock. If such an order's status changes later, its stock is brought in line
with the current rule in one movement you can see in the product's stock log.
Also applied: a swapped order holds no stock (the new order holds it), and an
order in exchange keeps its piece counted as out.
Nothing is blocked. Before the production database update, a read-only count of
these older orders on the real data is still wanted (it changes nothing). If you
already corrected stock by hand for some of them, say so — those would otherwise
be adjusted a second time when their status next changes.

### Q-4 · P0-8 · 2026-11-18 · answered-by-default
You swap an order to a new customer, and later the carrier sends an update for
the first parcel ("returned to sender", "delivered"…). Today the first order's
status follows the carrier, and that took the piece off stock a second time.
**Applied by default (D31):** the status still follows the carrier, but stock no
longer moves — the piece stays counted once, on the new customer's order. So a
swapped order whose parcel comes back shows as returned and counts as a return,
with its return fee, exactly as today. The other option: a swapped order keeps
showing "swap" and ignores later carrier updates. That changes what counts as a
return in your numbers, so it is yours to choose. One case to know: if the
carrier says the first customer did receive the parcel after you swapped it, two
pieces are out but one is counted — correct it on the product's stock page.
Nothing is blocked.

### Q-5 · P0-8 · 2026-11-18 · answered-by-default
The database lets an admin edit or delete a line of a product's stock log (no
screen in the app does it). The stock number does not follow such an edit, and
the order's stock can then be adjusted again later. **Applied by default:**
nothing changed — admins keep that right. Recommended: make the stock log
add-only, like the finance ledger (a mistake is fixed by adding a correcting
line). It removes a right from admins, so it waits for your yes. Nothing is
blocked.

## Answered

- **2026-11-18 · P0-8** — "A returned order later marked cancelled: does the
  item stay in stock?" → Owner: cancelled means the order was never confirmed,
  so it holds no stock. → D25.
- **2026-11-18 · CARRIER-0 / P1-7** — "Names, codes and fees for wilayas?" →
  Owner: use the file in `prices/`; fees must be editable in the app and
  replaceable by uploading a new CSV. → D26, D27.
- **2026-11-18 · P1-7 · Q-1, Q-2** — Béchar prices, wilayas with no price →
  Owner: keep the defaults, delivery prices must be editable in the app. → D27, D38.
- **2026-11-18 · P0-8 · Q-3** — Old orders and stock → Owner gave the stock rule:
  delivered leaves stock, on road is shown as on road, returned comes back. → D34.
- **2026-11-18 · P0-8 · Q-4** — Swapped order and carrier updates → Owner: it
  follows the carrier, costs the swap fee set in the delivery company config, and
  a returning parcel can be offered as a swap when a new order is confirmed. → D36, D37.
- **2026-11-18 · P0-8 · Q-5** — Make the stock log add-only? → Owner: yes. → D35.
- **2026-11-18 · P-1, K-1, T-1** — Calculator formulas, pixel ids, Telegram bot →
  Owner: settings the owner fills in the app, like Shopify. → D38.
