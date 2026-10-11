# Phase 15 — Full revision: one money model, ERP dashboard, ZR Express, UI rebuild

Origin: user request 2026-10-11 ("didn't like the frontend and how things are
working… full revision… cards showing defined calculations… CRM/ERP dashboard
for COD… ready to link with ZR Express… fees, benefit, stock"). Built from three
audits run the same day (feature/calculation inventory, OWASP review, screenshot
critique of every screen in both themes — Impeccable heuristic score **19/40
dashboard, 19/40 orders**). Tech stack stays.

**Order:** 15a ✅ → 15b → 15c → 15d → 15e → 15f → 15g → 15h → 15i → 15j.
14h (Google OAuth) stays last, still blocked on the user's GCloud setup.

## 🧰 Skills every 15-phase uses (docs/TOOLING.md §Design / quality / security)

| When | Skill |
|---|---|
| Before code | 🐴 `ponytail:ponytail` + 🧠 `karpathy-guidelines` (state assumptions + the check that proves it) |
| Any screen | 🎨 `cod-ui-polish` (authority) → 🎨 `impeccable` (`layout`, `polish`, `harden`; Operate mode) → 🧭 `ui-ux-pro-max` rules (a11y > touch > perf > layout > charts) → ✨ `frontend-design` |
| Charts / KPI tiles | 📈 `dataviz` |
| API routes, webhooks, RLS, auth, ZR | 🛡️ `owasp-security` review before merge (only reachable findings) |
| Before merge | 🐴 `ponytail:ponytail-review` · build + `npm test` + RLS suite (`LOCAL_SUPABASE_URL=http://127.0.0.1:54321`) · 📸 screenshots both themes + 390px |

## 🔒 Locked decisions (2026-10-11 — do not re-ask)

- **One money model.** Every "net profit" in the app comes from ONE SQL function
  (15b). The dashboard, finance overview, income page and product cards stop
  computing their own. The pricing *simulator* math stays in `src/lib/pricing.ts`.
- **COD fee semantics.** The customer pays `sale·qty + delivery_fee` to the courier,
  the courier keeps its fee and remits `sale·qty`. ⇒ The delivery fee is
  **pass-through** on delivered orders (not an expense). The merchant pays
  `return_fee` (default 150 DZD) per **returned** order. If a workspace offers
  free shipping later, add a setting — don't fork the formula.
- **Fixed fees** are monthly, **prorated by period days / 30** in every P&L.
- **Money display.** Whole DZD in lists/KPIs (`135 900 DZD` style via `format.ts`,
  never wrapping: `whitespace-nowrap`), 2 decimals only in unit economics.
  One formatter; `money-field`'s "DA" and the scenario engine's "-0" go away.
- **Dates** show dd/mm/yyyy (EN and AR). Native `type="date"` is replaced by one
  Radix popover range picker with presets.
- **Navigation:** one sidebar style (icon + title case for every top item),
  sections expand inline; page tabs stay; sidebar children are removed where
  they duplicate tabs. Brand sits top-left in the sidebar.
- **Statuses & colors** still only via `statuses.ts` / tokens. Risk: 0 → neutral,
  1–29 → warning, ≥30 → danger.

---

## 15a ✅ — Security hardening (OWASP) — DONE 2026-10-11

See PROGRESS.md. 00021: `account_balances` RLS leak (anon could read every
workspace's balances) fixed, profile self-move across tenants blocked,
seed/bootstrap revoked; open redirect, webhook body storage, replay scope,
`server-only`, security headers, settings autofill bug.
**Still open (user):** rotate the leaked `kimi.tx` key; decide on history purge
(`e686c83`, local only); `npx supabase db push` for 00020–00021.

---

## 15b 💰 — One money model (P&L function + unit economics)

The core fix. Today three "net profits" disagree (dashboard RPC ignores fixed +
return fees; `netProfit()` is all-time with fixed fees; income page = revenue −
return fees only), and ROAS/AOV/margin/CPA/break-even exist nowhere.

**Build:** migration `00022_pnl.sql` → `public.pnl_summary(p_from date, p_to date,
p_product uuid default null)` — `security invoker`, admin-only via the source
tables' RLS. Returns one row:

| Field | Formula |
|---|---|
| `orders_received` / `confirmed` / `delivered` / `returned` / `cancelled` | counts in period |
| 💵 `revenue` | Σ sale·qty of delivered |
| 📦 `cogs` | Σ sourcing cost (product_costs `amount_dzd`) · qty of delivered |
| ↩️ `return_fees` | returned × `settings.return_fee` |
| 📣 `ad_spend` | Σ `ad_spend_daily.amount_dzd` (split `ad_spend_test` / `ad_spend_scaling` by `kind`) |
| 🧾 `expenses` | Σ `expenses.amount_dzd` |
| 🏢 `fixed_fees` | Σ active monthly fixed fees × days/30 |
| ✅ `net_profit` | revenue − cogs − return_fees − ad_spend − expenses − fixed_fees |
| `margin_pct` | net_profit / revenue |
| `aov` | revenue / delivered |
| `roas` | revenue / ad_spend |
| `cpa_confirmed`, `cpa_delivered` | ad_spend / confirmed, ad_spend / delivered |
| `cost_per_delivered` | (cogs + return_fees + ad_spend + expenses + fixed_fees) / delivered |
| `confirmation_rate`, `delivery_rate`, `return_rate` | confirmed/received, delivered/confirmed, returned/(delivered+returned) |
| `breakeven_delivery_pct` | the delivery rate at which net = 0 given this period's costs |
| 💳 `cash_to_collect` | Σ sale·qty of delivered orders with no `cash_collections` row (status ≠ deposited) |

- Wire it into: dashboard KPIs (15d), finance overview + income (15h), product
  cards/statistics (`p_product`, 15g). Delete the three ad-hoc formulas.
- Fix the pricing "Real" column (`pricing-real.ts:257` hard-codes
  `delivery_fee_da = 0` → returns cost vanishes): use `return_fee`; align the
  lead-cost and spend windows (both last 30 days).
- **Tests:** a vitest file pinning the formula on a tiny fixture (one delivered,
  one returned, one ad spend day, one fixed fee) via the local DB, plus an
  assertion that an agent gets an error / no rows.

---

## 15c 🧭 — App shell, navigation, formatters, date picker, 4 states

- `app-shell.tsx` / `nav-model.tsx`: brand top-left; every top item = icon + label
  (🏠 Dashboard · 🛒 Orders · 📦 Products · 🏷️ Stock · 💼 Finance · 👥 Contacts ·
  🗂️ Team · ⚙️ Settings — lucide icons, not emoji, in code); chevron-expandable
  groups; active state; queue count badges (to confirm / to ship).
- Breadcrumb + back link on every `[id]` page (order detail has none today).
- `DateRangePicker` (Radix popover, presets Today / 7d / 30d / This month / Last
  month, dd/mm/yyyy) replaces `fields/date-field.tsx` range usage in every filter bar.
- Filter bars → one compact chip row + "More filters" popover + active-filter
  summary (dashboard, orders/all, finance, performance).
- One `formatMoney` path in `format.ts` (whole DZD, nowrap); remove "DA" variant.
- `loading.tsx` (skeleton) + `error.tsx` (reason + retry) per section — there are
  none today.
- Fix the Algeria map hydration mismatch (round projected coordinates).

## 15d 📊 — Dashboard rebuild (ERP/CRM home)

12-column grid, max 4 rows above the fold. Every card shows its formula in a
tooltip ("ⓘ revenue − COGS − returns − ads − expenses − fixed") and drills through.

1. **⚡ Today strip** (fixed, ignores filters): 🛒 orders today vs yesterday ·
   📞 to confirm · 🚚 to ship · 💳 cash to collect from courier · ⚠️ stuck parcels
   (in transit > N days).
2. **💰 Period KPI cards** (from `pnl_summary`, delta vs previous period):
   net profit · margin % · revenue · ✅ confirmation % · 🚚 delivery % · ↩️ return
   rate · 📣 ROAS · 🎯 cost per delivered order · 🧺 AOV.
3. **🧾 P&L waterfall** (revenue → COGS → returns → ads → expenses → fixed → net) +
   **📈 trend** (net profit and ad spend by day; fix "No data for this filter" when revenue exists).
4. **🚨 Alerts card**: 🏷️ low stock (15g threshold), 🏦 low account balance,
   🗺️ losing wilayas (auto stop-shipping), 📉 delivery rate below break-even.
5. Below the fold: funnel · wilaya map + sortable table (click filters the
   dashboard) · per-agent (with 14g timings) · per-product (net, ROAS, rates) ·
   spend by category **including ad spend**.
- Filters: separate confirmation-agent / delivery-agent (RPC already accepts both),
  multi-select where the RPC takes arrays.

## 15e 🛒 — Orders & queues that behave like queues

- Confirmation/Delivery default to **actionable** statuses only (terminal ones via
  a filter); badge count === row count; priority sort (risk, age, attempts).
- Fixed-width status slot (pills don't shift); `whitespace-nowrap` money and IDs;
  table in its own scroll container (orders/all overflows at 1440px today);
  card list below `md`.
- Row actions: 📞 tap-to-call, 💬 WhatsApp link, log attempt.
- Delivery queue shows 💵 COD amount to collect (sale·qty + fee), ZR tracking # + state.
- Order detail: one sticky save bar (today 4 saves incl. a "Save Save" bug),
  breadcrumb, wilaya shown, reason field only when cancelled.

## 15f 🚚 — ZR Express: ready to link

Already built: client lib, parcel push (home only), Svix-verified webhook,
territory sync, settings. Missing, in order:
1. **Tenant-safe webhook**: per-workspace URL token
   (`/api/webhooks/zrexpress/[token]`); today it picks the first active config
   across all workspaces (`.limit(1)`).
2. **Dedupe on `svix-id`** (unique index on `webhook_events(provider, external_id)`).
3. **ZR state → `delivery_status` mapping** — user-editable table in Settings
   (ZR states are per-account), applied by the webhook through the same status
   path as the UI (triggers write history + stock).
4. **Stop-desk** parcels (hub picker from synced territories).
5. **Bulk push** from the delivery queue + optional **auto-push on confirm** (setting, default off).
6. **Fee sync** — pull ZR rates into `wilaya_fees` if their API exposes them
   (verify against ZR docs first; otherwise keep manual + bulk paste).
7. Tracking # / ZR state column in delivery queue & order list; card readable by agents (RLS already allows).
- 🛡️ `owasp-security` review mandatory before merge.

## 15g 📦 — Products, pricing, stock

- Product overview = read-mode KPI cards (net, ROAS, delivery %, stock, stock
  value) + edit in a sheet; no image → compact icon, not a half-card grey block.
- Products list: search, stock count, whole-DZD net; drop the order-status pill on products.
- Pricing page: inputs grouped in collapsible sections, results sticky on the
  right; fix "Worst = Profit at 0%" and "-0 DZD"; "Euro price (DZD)" label.
- Stock: `low_stock_threshold` per product (migration) → alert + dashboard;
  💎 stock value (qty × unit cost); adjust via dialog (not 4 inline controls per row);
  movements history link.

## 15h 💼 — Finance

- Overview = P&L waterfall for the period (`pnl_summary`) + 💳 receivables
  (cash to collect from courier, aging) + 🏦 account balances — stop repeating
  dashboard KPIs. Every total drills through.
- Income page uses `pnl_summary` (no separate "net").
- Ad spend: test vs scaling split + ROAS per product.

## 15i ⚙️ — Settings, contacts, team polish

- Settings split into sub-routes (Workspace · Integrations · ZR Express · Fees ·
  Fixed fees · FX · Rules engine · Users · Audit) — today one 5 225px page with ~12 saves.
- Contacts: search-as-you-type; risk color thresholds; phone links on token color.
- Rules: replace native `<details>` triangles with the disclosure component;
  show 14e category chips.

## 15j ✨ — Final sweep

`impeccable` audit + polish on every section (both themes, 390px, RTL/AR),
target ≥ 30/40 on dashboard and orders; 🛡️ OWASP pass on the whole diff;
`ponytail-debt`; PROGRESS + DB.md + DESIGN_SYSTEM.md updated.
