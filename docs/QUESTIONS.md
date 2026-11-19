# Questions for the owner

The loop writes here when a task needs something only the owner can decide or
provide. Other work continues meanwhile. Answer in the session, or write the
answer under the question and it is picked up at the start of the next run.
What Claude decided by itself is in `docs/DECISIONS.md` ("Decided by Claude —
owner may overturn").

## Open

### Q-16 · STORE-3 · 2026-11-19 · answered-by-default
A customer whose phone is in dark mode opens your store. Should she see the
store in dark colours? **Applied by default (D61):** yes. The store is ivory
and burgundy for everyone else, and switches to the dark version of your
palette (dark wine background, rose prices) only when her phone asks for dark.
This is what your approved colour table already says: it has a dark value for
every colour. The other option: the store is always light, whatever the phone
says, so every customer sees exactly the ivory brand look. It is a one-line
change. Say so if you want it. Nothing is blocked.

### Q-15 · STORE-3 · 2026-11-19 · answered-by-default
You make an offer "2 pieces for 9,000 DZD". May the customer take two
different sizes (one M and one L)? **Applied by default (D61):** yes. The offer
is for any 2 pieces of that product. She pays 9,000, and never more than the
two pieces would cost one by one. Example with a different price per size, S
5,000 and XL 7,000: S + XL costs 9,000 instead of 12,000. Reason: two sizes in
one order is the usual case (for her and her sister), and refusing the offer
there loses the sale. The other option: the offer only counts when both pieces
are the same size. Say so if you want it; it is decided before the order form
goes live, so no customer has been charged either way. Nothing is blocked.

### Q-14 · STORE-3 · 2026-11-19 · answered-by-default
An offer such as "2 pieces for 9,000 DZD" could also promise free delivery.
Should your offers be able to do that? **Applied by default (D60):** not for
now. An offer changes the product price only, and the customer always pays the
delivery price of her wilaya on top, as today. Nothing on the store says "free
delivery". Reason: free delivery means you pay the carrier instead of the
customer. In your price sheet that is 500 to 1,600 DZD per home order (Algiers
700) and 370 to 1,120 per stop-desk order, and your money rule today says the
delivery price is never a cost for you. The other options: (a) allow it on the
offers you choose: the customer pays the products only, you pay the carrier,
and that amount is counted as a cost of that order in your profit, like the
return fee; the offers screen shows what it costs you. This is the one
recommended if you want free delivery. (b) the same, but only for stop-desk
delivery, which costs you less. Say which one you want; it is then added
together with the order form, the step that computes the delivery price.
Nothing is blocked.

### Q-13 · STORE-1 · 2026-11-18 · answered-by-default
A product already has its sizes saved (S, M, L). Later you want to add a second
option to it, for example the colour. **Applied by default (D55):** this is not
possible on that product. Once sizes are saved you can still add or rename
values (a new size XL) and switch a size off, but not add or remove an option;
the screen says so. Reason: the existing S, M and L would have no colour, and
their stock and their orders could not be given one without guessing. To sell a
product in several colours, create both options before saving its first sizes.
The other option: allow it, and you choose which colour the existing sizes
become. Say so if you want it. Nothing is blocked.

### Q-12 · STORE-1 · 2026-11-18 · answered-by-default
A customer exchanges size M for size L. When does the M count as back in your
stock? **Applied by default (D54):** you change the size on the order to L. One
L leaves stock and the M counts as back at once, although it is still on its
way back to you. The total for the product stays right (one piece out, as
today). If that M never arrives or cannot be sold again, add a correction line
on the product's stock page. The other option: the M stays out of stock until
you add it back by hand once it is on your shelf. It is never counted too
early, but it is one manual step on every exchange. Say so if you want it.
Nothing is blocked.

### Q-11 · STORE-1 · 2026-11-18 · answered-by-default
Products get a stock number per size and colour. Today the app only knows the
total per product (for example 144 pieces of a dress, not how many S, M and L).
How should the sizes start? **Applied by default (D54):** nothing is guessed.
The 144 stay on the product as "not assigned to a size" and each size starts
uncounted. On the product's stock page you type what is on the shelf (S 40,
M 50, L 54) and the pieces move to the sizes; the total does not change. Until
you count, orders still ship and the store still sells: a size that sold
before being counted shows a minus number and "count needed". When you buy new
stock you choose the size it goes to. The other options: split the total
evenly between the sizes (numbers that look real but are wrong), or stop
selling a product until it is counted. Say so if you prefer one. Nothing is
blocked.

### Q-10 · PRICE-2 · 2026-11-18 · answered-by-default
In a product's price calculator you can type a "final price" to see what you
would earn at that price. When that price loses money, should saving it ask
"are you sure?" **Applied by default (D53):** no. It saves normally, and a red
line under the table says in which case (best / medium / worst) the product
loses money. This number is only your calculation: it does not change the price
in the store or on any order. Your own benz example (final price 4,500) already
loses 228 DZD per piece in the worst case, so a question would appear on almost
every product. The other option: ask for confirmation only when the price also
loses money in the medium case (on benz: below 3,962 DZD). Say so if you want
it. Nothing is blocked.

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
