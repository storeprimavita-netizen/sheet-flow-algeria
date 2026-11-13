# Pricing & Risk — how the numbers are computed

Two independent models live in this app. Neither is a black box: every derived
number is recomputed from stored inputs, so the math can always be traced.

- **Product pricing** → `src/lib/pricing.ts` (COD unit economics, per product).
- **Customer risk** → `customer_stats` view (`supabase/migrations/00006_analytics.sql`).

---

## 1. Product pricing (unit economics)

Ports the `BENZ Pricing (31).xlsx` spreadsheet cell-for-cell. Only the **14
inputs** are stored (`product_scenarios.inputs` jsonb); everything below is
derived live in the UI so it can never drift from the sheet. Three scenarios
per product: **best / medium / worst**.

### The 14 inputs

| Group | Input | Meaning |
|---|---|---|
| Funnel | `euro_price` | EUR→DZD rate |
| Funnel | `lead_cost_eur` | cost per lead (€) |
| Funnel | `confirmation_pct` | % of leads that confirm |
| Funnel | `delivery_pct` | % of confirmed that deliver |
| Funnel | `spend_eur_day` | daily ad spend (€) |
| Funnel | `delivery_fee_da` | courier fee per shipped parcel (DA) |
| Per-order | `product_price` | product COGS (DA) |
| Per-order | `sale_price` | sale price (DA) |
| Per-order | `delivery_price` | per-order delivery surcharge (DA) |
| Per-order | `confirmation_agent` | agent commission / order (DA) |
| Per-order | `packaging_fees` | packaging / order (DA) |
| Fixed | `flexy_month` | flexy / proxy & tools (DA/month) |
| Fixed | `location_day` | rent + electricity (DA/day) |
| Fixed | `salary_month` | employee salary (DA/month) |

### The formulas (exactly as in `computeScenario`)

```
confirmation_cost_da = euro·lead·100 / confirmation_pct        # ad cost per confirmed order
delivery_cost_da     = confirmation_cost_da·100 / delivery_pct # ad cost per delivered order

daily_ad_da       = spend_eur_day · euro_price
confirmed_per_day = daily_ad_da / confirmation_cost_da
delivered_per_day = daily_ad_da / delivery_cost_da

# extra courier cost carried by the orders that DID deliver, for the ones that came back:
returns_fee = (confirmed_per_day − delivered_per_day) · (delivery_fee_da / delivered_per_day)

# fixed monthly/daily costs spread across delivered orders:
other_fee_per_order = (flexy_month/30 + location_day + salary_month/30) / delivered_per_day

cost_per_order = product_price + delivery_cost_da + delivery_price
               + confirmation_agent + packaging_fees + returns_fee + other_fee_per_order

net_profit_per_order  = sale_price − cost_per_order
net_profit_per_day    = net_profit_per_order · delivered_per_day
net_profit_per_month  = net_profit_per_day · 30
```

Every division is guarded (`div(a,b)` returns 0 when `b=0`), so a blank WORST
scenario yields 0 instead of `#DIV/0!`.

### Break-even indicator

`breakEvenDeliveryPct(inputs)` answers: **"what is the lowest delivery rate at
which this product stops losing money, holding everything else fixed?"** It
scans `delivery_pct` from 0.5→100 in 0.5 steps (the model isn't cheaply
invertible — `delivery_pct` feeds four derived lines) and returns the first %
where `net_profit_per_order ≥ 0`, or `null` if it never breaks even at 100%.

**Reading it:** if it says 55%, the product only makes money once ≥55% of
confirmed orders actually get delivered. Compare that to the customer base's
real delivery rate (below) to sanity-check a product before scaling ads.

---

## 2. Customer risk score

Computed in the `customer_stats` SQL view, per customer, on the fly.

### Weighted risk (current, kept)

Weights live in Settings → `risk_weights` (defaults: returned **2**,
cancelled **1**, no_answer **0.5**) and are admin-tunable.

```
points = w_returned·returned_orders
       + w_cancelled·cancelled_orders
       + w_no_answer·(no_answer + closed_phone) orders

risk_score = min(100, round(100 · points / (w_returned · total_orders)))
```

A customer whose **every** order came back returned scores **100**. The
denominator normalises against "if every order were the worst outcome", so the
score is a 0–100 severity, not a raw count.

**Why weighted, not a flat percentage:** a *returned* parcel costs you the
round-trip courier fee and ties up stock; a *no-answer* costs a phone call.
Treating them equally would rank a chronic no-answer the same as someone who
burns a real delivery. The weights encode "how much each bad outcome actually
hurts" and stay tunable so you can recalibrate from experience.

### Delivery rate (new, added alongside — not a replacement)

```
delivery_rate = delivered_orders / total_orders     # e.g. 2/5 = 40%
```

Both `delivered_orders` and `total_orders` already exist in the view, so this
is just surfaced next to the risk score — no new computation.

### Why keep both instead of switching

You asked whether to replace risk with `delivered / ordered %`. They answer
**different questions** and are strongest together:

| | Risk score | Delivery rate |
|---|---|---|
| Question | *How bad, and why?* | *What's the raw track record?* |
| Distinguishes returns from no-answers | ✅ | ❌ |
| Instantly legible to an agent | ⚠️ (needs the formula) | ✅ ("40% delivered") |
| Tunable to your economics | ✅ | ❌ (fixed ratio) |

A customer with 40% delivery rate could be "declined a lot but never returns"
(cheap) or "returns half" (expensive) — same rate, very different risk. Risk
tells the agent *how hard to push*; delivery rate tells them *the plain odds*.
Showing both is one extra column and loses nothing. **Recommendation adopted:
keep the weighted score, add the delivery-rate column beside it.**
