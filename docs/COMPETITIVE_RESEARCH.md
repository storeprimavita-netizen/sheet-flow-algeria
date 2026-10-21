# Council A - COD competitor research (2026-10-21)
Public marketing pages only; no private dashboards accessed. "D" = publicly documented (vendor claim), "A" = assumed/not stated.
codpilot.net returned HTTP 403: NOT reviewed, no claims made.

## Matrix
| Area | ePilot (MA) | Tora (MA) | ConfirmFlow (PK) | eGrow (DZ/MENA) | DZBuild (DZ) |
|---|---|---|---|---|---|
| Dashboard | D: live KPIs confirm/returns/AOV, today/yday/30d | D: real-time orders/stages/agents | D: exec ops dashboard + Ads Manager | A | A |
| Order queue | D: single priority-ranked call queue | D: import, assign to agents, status | D: 20-stage pipeline, stuck orders | D: unconfirmed routed to humans | A |
| Confirmation | D: AI WhatsApp agent (darija/FR) | D: team-based (method unstated) | D: WhatsApp confirm/cancel buttons, scammer-number shield (10k+ claimed) | D: AI agent call/WA/SMS | A |
| Couriers | D: Sendit, Cathedis, Ozon; 1-click labels | D: 20+ MA couriers | D: 12+ couriers, bulk dispatch, thermal waybill | D: "80+" incl. ZR, Yalidine, Speedaf | D: Yalidine, EcoTrack family (82 tiles), ZR (legacy+new), Maystro, Noest + ~15 more; push, polling, rate sync, stop-desk |
| Inventory | D: sync across stores | D: catalog+inventory (Pro) | D: warehouse + POS + barcode | A | A |
| Product analytics | D: Pro reports | D: agent stats | D: net profit (COGS+ads), hot products, ROAS | D: "Marketing & Analytics" | A |
| Cash reconciliation | not mentioned | not mentioned | D: courier payment sheet (CPR) vs delivered, short-pay flags | D: auto-match carrier cash | D: explicitly NOT handled |
| Ad attribution | not mentioned | D: Meta spend sync, cost per confirmed/delivered | D: Meta+TikTok sync, UTM source-to-product | not covered | A |
| COD landing pages | not mentioned | not mentioned | not mentioned (tracking page per order) | not mentioned | A |
| Price | 199/349/699 MAD/mo | $39/mo | Rs 3-7k/mo | unclear | A |

## Adopt / Improve / Avoid for MNW
Adopt:
- Single priority-ranked confirmation queue (ePilot, Tora).
- Cost per confirmed AND per delivered order (Tora) - fits MNW admin-only financials.
- Courier cash sheet vs delivered orders matching with short-pay flags (ConfirmFlow).
- Stuck-order detection (ConfirmFlow); stop-desk + commune-level rates (DZBuild).
- Courier tracking by polling plus webhook (DZBuild uses polling; MNW already has ZR webhooks).
Improve:
- Reconciliation: DZBuild declines it; ConfirmFlow/eGrow only claim it. Make it a first-class admin-only ledger tied to pricing.ts net profit.
- Fraud/risk: shared blocklist is claimed by ConfirmFlow; MNW can use its own history (return rate per phone/wilaya) - no external DB needed.
- Net profit per product after returns, delivered-only (competitors lead with ROAS).
Avoid:
- AI voice/WhatsApp agent (cost, WhatsApp API fees billed separately, ops risk) until manual flow is solid.
- POS/warehouse barcode scope creep; 80+ shallow courier tiles. Do Yalidine, ZR, EcoTrack deeply.
- Marketing claims ("#1", scammer DB size) - unverifiable.

## Differentiation for Algerian merchants
1. Algeria-native: 58/69 wilaya, commune, stop-desk vs home delivery pricing; Arabic/Darija RTL first (competitors are Morocco/Pakistan-centric; Moroccan pages list no Algerian couriers).
2. Truthful profit: delivered-only margin incl. return shipping, courier fee, ad spend, FX (USD/EUR ads) - one pricing engine.
3. Role wall: agents never see money (RLS), a differentiator vs "unlimited users" tools.
4. Reconciliation against Yalidine/ZR/EcoTrack remittance cycles (delay 5-10 business days per eGrow secondary claim, unverified).
5. Standalone COD landing pages: no competitor page above documents them (gap; LightFunnels/YouCan are page builders lacking post-order COD, per eGrow - vendor claim). Lightfunnels-Algeria web search found nothing; unverified.

## MNW scope (docs/SPEC.md headings)
Orders, Products, Contacts, Pricing engine, Dashboard BI, Team & Rules, Settings. Landing pages not a heading (gap).

## Sources
- https://epilot.ma
- https://tora.ma
- https://confirmflow.pk
- https://www.egrow.com/en/blog/best-cod-software-algeria-2026
- https://dzbuild.com/docs/couriers/overview
- https://help.dzbuild.com/en/articles/16345634-couriers-overview
- https://www.egrow.com/en/blog/best-delivery-companies-algeria-cod-2026
- https://pickyourapp.com/products/homiflow (search snippet only)
- https://codpilot.net/en (403, unread)
