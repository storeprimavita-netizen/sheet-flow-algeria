# Questions for the owner

The loop writes here when a task needs something only the owner can decide or
provide. Other work continues meanwhile. Answer in the session, or write the
answer under the question and it is picked up at the start of the next run.
What Claude decided by itself is in `docs/DECISIONS.md` ("Decided by Claude —
owner may overturn").

## Open

### Q-25 · STORE-7 · 2026-11-19 · answered-by-default
Reviews on the store: you record them yourself in Store > Reviews (name, stars,
text, optional order number) and approve the ones to show. Customers cannot
send a review from the public page; there is no public form, so nothing can be
spammed or faked. The "order confirmed" mark only appears when the linked order
is for the same product, is confirmed and is not a test order. Names show as
first name + initial. **Applied by default:** no public submission. If you want
customers to submit reviews later, that is a new task with a form, spam
protection and a moderation step.

### Q-24 · PRICE-4 · 2026-11-19 · answered-by-default
The new Pricing page is finished and its numbers passed three reviews. The
third review found one serious point, and it is not in the Pricing page: it is
in the file export that Pricing shares with "All orders". A customer can type
anything as her name on the store. A name written in a certain way (for
example `Ali;=...`) can become a formula when the orders export is opened in
Excel on a computer set to French or Arabic, where Excel separates columns with
a semicolon. The app you use today has this weakness and a wider one (a name
that simply starts with `=`); this task already closes the wider one.
**Applied by default (D69):** one last short round that fixes only the export
file, then a normal review. If it passes, the task is merged. If it does not,
there is no further round and no merge: the task waits for your OK. The other
options were to park the task now (the export keeps no protection at all
meanwhile) or to move the export fix to a separate task. What you will see: a
name or note that looks like a formula gets a `'` in front of that part in the
exported file; phone numbers and amounts are not changed. Until this reaches
the live app: if Excel shows a security warning when you open an orders export,
answer No.
Worth a word later: when you open an export in Excel, does everything land in
one column, or do phone numbers lose their first 0? If yes, say so: the export
can be made a real Excel file (or use semicolons), which fixes both. Nothing is
blocked.

### Q-23 · PRICE-4 · 2026-11-19 · answered-by-default
The new Pricing page (one line per product, with totals) shows "Capital
needed". Your calculator had this number, but its rule is not in the text you
pasted. **Applied by default (D68):** capital needed = what the pieces in stock
cost you + the ad budget needed to sell them, in dinars, for the case you pick
(best / medium / worst). It is the sum of the two cards beside it, and the card
says so. Example on benz (stock 81,600 DZD, 50 pieces): best 107,199 · medium
141,351 · worst 173,700. Not counted: return fees, confirmation, packaging and
the other fees. They are paid as the orders go out and come back, and they are
already in the cost per piece and in the profit. Two things to know: the stock
part is the product cost you entered × the pieces in stock today, so if that
cost does not include shipping and customs to Algeria, this number does not
either; and a product with no cost, no stock or no ad cost is left out of all
the totals, with a note saying how many are left out. The other options:
(a) also add the fees you pay whatever you sell (other fees for the whole stock
+ the platform's monthly fee): benz medium 158,746; (b) every cost of the
batch: benz medium 174,843. Say which one your calculator used; it is one line
to change. This number is only your calculation aid: it changes no price, order
or profit report.
Also applied: the first calculator (the planner) leaves the menu and its old
address opens the new Pricing page. What you saved in it stays in the database,
untouched, but no screen shows it any more. Say so if you want it deleted, or
want something from it back. Nothing is blocked.

### Q-22 · PRICE-3 · 2026-11-19 · answered-by-default
The price calculator gets a fourth column, "Real", filled with the product's
actual results. Two points about what it shows. **Applied by default (D67):**
1. **Delivery %.** Real uses the same delivery % as the dashboard: delivered
   parcels out of the parcels that already have a final result (delivered or
   returned). Parcels still on the road are not counted as failed. Example: 100
   confirmed orders, 60 delivered, 15 returned, 25 still on the road → 80%, not
   60%. When more than 20% of the orders are still open, the column says
   "Preliminary". Same for the confirmation %: orders still waiting for a call
   are left out. Reason: counting parcels on the road as lost made the column
   ask for a third more orders than needed and showed a second, lower delivery
   % next to the dashboard's. Known limit: returns come back slower than
   deliveries, so the % can read a little high while parcels are on the road.
   The other option: count only orders older than a number of days (for
   example 15), when almost every parcel has its result. It is the most exact,
   it needs a database change, and you would give the number of days. Say so if
   you want it.
2. **Ad cost per order in dollars.** Real shows your real ad spend in dinars
   per order received, turned into dollars with the calculator's own rate (255),
   with the dinar amount small under it and a note saying so. Finance uses
   another rate, so the same spend can read $10.20 here and $10.83 there; the
   dinar amount is the same in both. Reason: the calculator's other dollar
   numbers (what you type, the maximum ad cost) use 255, so they stay
   comparable. The other options: dinars only, or the Finance rate.

This column is only your calculation aid: it changes no price, order or profit
report. Nothing is blocked.

### Q-21 · STATS-3 · 2026-11-19 · answered-by-default
Seasons and the new filters of the Statistics page are built. The fourth review
found nothing serious and nothing wrong in the database, the money or the
roles. Two medium points are left, both on the small filter labels above the
All orders list when you open it from a Statistics number: the category label
does not say which category, and the delivery type shows the raw word "home"
instead of its translated name. The rule for a fifth review round is written
two ways. One says: only while the number of serious and medium points keeps
dropping (it went 6, 4, 2, 2, so not this time). The other says: while the list
of findings keeps getting shorter (12, then 11). **Applied by default (D66):**
one last short round for these two labels, then a normal review. If it passes,
the task is merged. If it does not, there is no further round and no merge: the
task waits for your OK, like the store offers task. The other options were to
park it for you now, or to merge it now and send the two labels to a follow-up
task. Worth a yes or no later:
1. When the number is equal instead of lower, should the run do the last round
   as here (recommended: the points left were new, small and in one place), or
   stop there?
2. Your rule of 18 November says a task that has used its rounds, with nothing
   serious open, is merged. The merge step refuses without a passed review, so
   today such a task waits for you (the store offers task does). Should it be
   merged with its open points in a follow-up task, as that rule says, or keep
   waiting for your OK each time?

Nothing is blocked.

### Q-20 · STATS-2 · 2026-11-19 · answered-by-default
When the night run started its fifth batch, it found unfinished files of the
Statistics page left over from an earlier run that was cut short, and saved
them on the shared branch as they were. That draft was never tested or reviewed
and needs a database change that is not there, so the page could not work.
Meanwhile the Statistics page was rebuilt from its plan, tested and reviewed
twice. **Applied by default (D65):** the draft is set aside and the reviewed
version goes in. Nothing is deleted: the draft stays in the history and can be
brought back. All 17 draft files belong to the Statistics page and each one has
its reviewed replacement. If you had changed one of them by hand (the wilaya
table, the map, the dashboard filter, the Statistics texts), say so and it will
be put back on top. Worth a yes or no later: the night run could save leftover
files on a side branch instead of the shared one, so this cannot happen again.
Nothing is blocked.

### Q-19 · STATS-2 · 2026-11-19 · answered-by-default
The new Statistics page shows, for each wilaya and commune, the orders
received and the confirmation, delivery and return rates. Who may open it: you
only, or your agents too? **Applied by default (D64):** admins only, like the
dashboard, where this table and its map were until now. Agents keep their queue
and see nothing new. Reason: an agent only has access to part of the orders
(the waiting ones and their own), so the page would show them numbers that look
like the wilaya's results but are not. On the test data the admin sees 59
orders and 76% confirmed, while a delivery agent sees 38 orders and 100%. The
other option: agents open the page too, limited to their own orders and
labelled "your orders". It lets an agent see where their calls work, but most
wilayas would say "not enough orders to judge" for a single agent, and the
numbers would not open the list of orders behind them. Their own confirmation
numbers are already planned on the agent home page ("My day"). Say so if you
want agents to see this page as well. Nothing is blocked.

### Q-18 · CONF-1 · 2026-11-19
Saved views for the orders pages (confirmation, delivery, all orders) are built
and the database side has been clean since the second review. The fourth and
last allowed review still did not pass, because of the search box on the
confirmation and delivery pages. The rule set before that round (D63) says the
task then waits for you: no fifth round and no merge without your word. Nothing
here touches orders, money or what a role can see; it is only about filters on
the screen. Two problems are left:
1. **Status filter lost.** You pick a status (for example "No answer") and type
   in the search box while the list is still loading: the search arrives, but
   the status goes back to what it was and you have to pick it again. On a slow
   connection this can happen every day. The fix is known: one line and one test.
2. **Search arrives 5 seconds late.** You type a search and press any button
   (Compact rows, Columns, theme, Refresh, the menu) less than a third of a
   second after the last letter: the list is filtered about 5 seconds later
   instead of at once, and a view saved inside those seconds is saved without
   the typed search. With the keyboard only (Tab, then Enter on a view), the
   typed search can follow you into the view you open, which then shows
   "Modified". This needs a press right after typing, so it is rare. Its fix
   touches the Save buttons, and this kind of change is what reopened a problem
   in each of the last three rounds.

How do you want to finish it?
- **(a) Recommended: one last short round for problem 1 only, then merge.**
  Problem 2 is accepted for now and written into the follow-up task CONF-1-F
  with the other small points (search that finds nothing says "Queue is empty"
  instead of "no match", and the open points of reviews 2 and 3). The review of
  that round judges problem 1 and its tests; if it passes, the task is merged.
  If it does not, it comes back to you and there is no further round. Why: the
  daily problem is fixed with the smallest possible change, and the rare one
  does not hold the three tasks waiting behind it.
- **(b) One more full round for both problems**, then merge only if the review
  passes. Everything is closed before the merge, but it is the larger change,
  it may fail a fifth review, and the next tasks wait longer.
- **(c) Merge as it is.** Both problems go to CONF-1-F. The fastest, but your
  agents meet problem 1 until the follow-up is done, although its fix is one line.
- Anything else you prefer, for example the search starts only on Enter instead
  of while typing (it removes this whole family of timing problems, but it is a
  change of behaviour on these pages).

Blocked until you answer: CONF-1 is parked and not merged, and CONF-2 (kanban),
CONF-3 (customer score card) and CONF-4 (call attempts and callbacks) wait on
it. Other work continues. Details: `docs/briefs/CONF-1.review-4.md`.

### Q-17 · P1-7 · 2026-11-19 · answered-by-default
(Q-15 and Q-16 belong to the store offers task and arrive when it is merged.)
In Settings, "Sync delivery fees from ZR" copies ZR's prices into your delivery
prices. Should it also switch shipping on for a wilaya that is off because it
has no price? **Applied by default (D62):** no. The sync only updates prices. A
wilaya ships only when your price sheet gives it a price, or when you turn its
"Priced" switch on yourself; ZR's price is then already filled in. After a sync
the app tells you how many wilayas are still off. Reason: your sheet leaves 4
wilayas with no price (Illizi, Tindouf, Bordj Badji Mokhtar, Djanet) and gives
2 home delivery only (In Guezzam, El Meghaier). ZR has a price for every place
it serves, so a sync that switched wilayas on would put those back on sale at
ZR's price in one click. The other option: a sync switches on every wilaya ZR
gives a price for. It is faster the first time, but it overrides your sheet.
Say so if you want it (it is one line to change).
Also applied: a delivery price of 0 is never accepted for a wilaya that ships.
A 0 in the sheet, in the price table or from ZR counts as "no price" (free
delivery stays Q-14).
To know before the production database update: a wilaya whose home price is
still 0 will have shipping off, and a wilaya whose stop-desk price is 0 will
lose stop-desk, until you upload your sheet or turn the switch on. Confirmed
orders not yet sent to ZR for those wilayas cannot be sent until then. A count
you can run before the update will be in PROGRESS.md. Nothing is blocked.

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
