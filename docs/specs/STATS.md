# STATS — customer score and statistics

All rates follow the KPI contract (D4): computed in SQL (`kpi_lines`),
returning numerator, denominator and a matured flag; pages never re-derive a
rate. P1-1 (the contract migration) is the prerequisite for everything here.

## Customer score

- Kept: `customer_stats.risk_score` and its tunable weights.
- Added per customer: delivery rate (delivered ÷ shipped, matured only),
  orders per product (how many times they ordered each product), last order,
  first order, lifetime delivered value (admin only), and a plain-language
  reason for the band ("2 of 3 orders returned").
- Shown: hover card in the confirmation views (CONF-3), customer detail,
  and as a filter band (reliable / new / risky).
- A new customer has no score — shown as "new", never as 0% or 100%.

## Wilaya statistics (Home dashboard + Sell → statistics tab)

Per wilaya (and commune on drill-down), for the filtered period:
orders received · **confirmation rate** · **delivery rate** · return rate ·
average days to deliver · share home vs stop-desk · top return reasons.
Table with in-cell bars + the existing map; click = orders filtered to it.
Small denominators are flagged ("12 orders — not enough to judge") instead of
coloured red or green.

## Filters (one bar, state in the URL)

Date range · **season** · product · category · wilaya · source/store/campaign
· agent · carrier · delivery type.

**Seasons** = named date ranges the admin defines in Settings (seeded:
Ramadan, Eid al-Fitr, Eid al-Adha, summer, back-to-school, winter; dates
entered per year because the Hijri ones move). A season filter compares the
same season across years when data exists.

## Other cuts the data already supports

- By weekday and hour of order → when to staff confirmation, when ads convert.
- Time-to-first-call vs confirmation rate (from `order_status_history`).
- Attempts needed to confirm; confirmation rate by attempt number.
- By product × wilaya (where a product fails to deliver).
- By agent (kept), by source / store page / campaign (utm, once STORE-4 ships).
- By carrier and delivery type (once a second carrier exists).
- Carrier state history (ZR): days in each state, where parcels get stuck,
  first-attempt delivery rate, return situations.
- Duplicate-order share and abandoned-checkout recovery rate (after STORE-5).
- Cost per received / confirmed / delivered order (admin; needs ad spend).

Not available, do not show: a carrier "customer reliability" score (D11),
anything about a customer from other merchants.

## Rules

- Agents see operational rates for their own work; no money columns.
- Every number drills through to the orders behind it (interconnection rule 2).
- Charts stay hand-rolled SVG (D3); one question per chart.

## Tasks

P1-1 KPI contract · STATS-1 customer score fields + reasons · STATS-2 wilaya
confirmation/delivery table + commune drill-down · STATS-3 seasons + unified
filter bar · STATS-4 time/attempt/product×wilaya cuts · P1-2 dashboard rebuild
on top of these.
