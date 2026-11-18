# Questions for the owner

The loop writes here when a task needs something only the owner can decide or
provide. Other work continues meanwhile. Answer in the session, or write the
answer under the question and it is picked up at the start of the next run.
What Claude decided by itself is in `docs/DECISIONS.md` ("Decided by Claude —
owner may overturn").

## Open

### Q-1 · P1-7 · 2026-11-18 · answered-by-default
In your price file, Béchar (8) has two home prices and no office price:
"home 1350 | home 720". **Applied by default:** home 1350, stop-desk 720 (every
other wilaya is written home | office, and 720 fits the office range). Change it
in Settings → Delivery fees if that is wrong.

### Q-2 · P1-7 · 2026-11-18 · answered-by-default
Four wilayas have no price in your file: Illizi (33), Tindouf (37), Bordj Badji
Mokhtar (50), Djanet (56). **Applied by default:** shipping to them is switched
off until a fee is entered. In Guezzam (54) and El Meghaier (57) have a home
price only, so stop-desk is not offered there.

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

## Answered

- **2026-11-18 · P0-8** — "A returned order later marked cancelled: does the
  item stay in stock?" → Owner: cancelled means the order was never confirmed,
  so it holds no stock. → D25.
- **2026-11-18 · CARRIER-0 / P1-7** — "Names, codes and fees for wilayas?" →
  Owner: use the file in `prices/`; fees must be editable in the app and
  replaceable by uploading a new CSV. → D26, D27.
