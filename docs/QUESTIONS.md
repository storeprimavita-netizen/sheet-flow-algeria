# Questions for the owner

The loop writes here when a task needs something only the owner can decide or
provide. Other work continues meanwhile. Answer in the session, or write the
answer under the question and it is picked up at the start of the next run.
What Claude decided by itself is in `docs/DECISIONS.md` ("Decided by Claude —
owner may overturn").

## Open

Nothing is waiting for an answer. On 2026-11-24 the owner asked for every question
in this list to be settled by Claude Fable: the two that were open got their
recommended answer, the others were already applied by default and are confirmed
(D102–D104). Each can still be overturned: say so and it is changed.

**Only you can tell — no task waits on these:**
- Orders export opened in Excel: does everything land in one column, or do phone
  numbers lose their first 0? If yes, the export becomes a real Excel file (Q-24).
- "Capital needed" on the Pricing page = stock cost + ad budget (D68). If your old
  calculator also counted the fixed fees, say which of the two other formulas (Q-23).
- If you or your agents use the app on an iPhone: open it once and say whether the
  bottom bar sits too close to the edge (NAV-5, D87).
- Before the production database update: the read-only count of older orders whose
  stock was counted under the earlier rules (Q-3) and of wilayas with a 0 price
  (Q-17) — part of owner input O-2.

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
- **2026-11-20 · CHART-1 (Q-28)** — merge as built, or another round? → Answered by default (a): merge; the three mediums go to CHART-1-B (cap the chart at 366 days first). → D94.

- **2026-11-27 · CONF-6 · answered-by-default (D106)** — Can "apply an offer during the call" be built now, as a screen change only? → No: it waits for the store's order submit (STORE-4) and needs a database change. As the confirmation page spec already says, an agent will be able to apply one of the offers you defined to an order she is confirming; the app sets the price, she never types one, and she still cannot change quantity or price any other way. Say so if agents should not apply offers at all.
- **2026-11-24 · STORE-4 · Q-31** — A buyer accepts three pieces for 10,000 DZD, then asks for two before dispatch: what total is recorded? → Fable, on the owner's instruction: the app quotes the two pieces again from the current store prices and the offer that applies, shows the new total to the admin, and saves it once the buyer agrees; the first checkout receipt is kept. A negotiated amount typed by hand is not part of this (a discount during the call is CONF-6). → D102.
- **2026-11-24 · P1-1-F · Q-30** — Ads paid before the first order: are they in the all-time profit? → Fable, on the owner's instruction: yes, on the days they were paid; daily fixed fees still start on the day of the first order. The daily chart follows the same rule. → D103.
- **2026-11-24 · VAR-1 · Q-26** — Merge the product options as built? → Already done: merged under D93, the two screen points are in VAR-1-F.
- **2026-11-24 · answered-by-default, confirmed (D104)** — each was applied when it came up and stays as applied:
  - Q-6 a confirmed piece not yet with the carrier is shown as reserved (D34) · Q-7 a deleted order gives its pieces back only if they never left the warehouse (D41, D42) · Q-3, Q-4, Q-5 were answered by the owner on 2026-11-18 (D34–D37, above).
  - Q-8 profit % is a % of the product's own cost (D51) · Q-9 highest accepted profit % is 1000 (D52) · Q-10 a final price that loses money saves with a red line, no "are you sure?" (D53) · Q-22 the "Real" column uses the dashboard's delivery % and the calculator's dollar rate (D67) · Q-23 capital needed = stock cost + ad budget (D68) · Q-24 formula-looking names are neutralised in exports (D69).
  - Q-11 sizes start uncounted, nothing is guessed (D54) · Q-12 on a size exchange the returned size counts as back at once (D54) · Q-13 adding an option to a product that has sizes is allowed (overturned by the owner, D76).
  - Q-14 offers never include free delivery for now (D60) · Q-15 an offer for N pieces accepts mixed sizes (D61) · Q-16 the store follows the phone's dark mode (D61) · Q-25 reviews are recorded by the admin, no public form.
  - Q-17 syncing delivery fees from ZR never switches a wilaya on; a 0 price means no price (D62) · Q-19 the Statistics page is for admins only (D64) · Q-20 unfinished files from a cut-off run are never saved on the shared branch (D65; `scripts/night.sh` now sets them aside or refuses to start) · Q-29 agents do not get the Tasks, Meetings and Rules pages; My day shows their own tasks read-only (D86).
  - Q-18, Q-21, Q-27, Q-28 "one more review round or merge?" → settled for good by D89 and D90: at most two review rounds; with nothing serious open the task is merged and its open points go to one follow-up row (D63, D66, D79, D82–D85, D87, D92–D94).
