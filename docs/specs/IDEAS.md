# IDEAS — features seen in Algerian and Moroccan COD tools

Researched 2026-11-17 from public pages (earlier round: `docs/COMPETITIVE_RESEARCH.md`).
"Who has it" is what each vendor publicly claims, not something we tested.
Not found or unreadable: Octomatic, Zendo, Shopily, Dropify, Sendit, Scalefy,
Confirmi, ConvertedIn; Ecomanager's own site refused access.

## Suggested for this platform

| # | Feature | Who has it | Where it lands in our plan |
|---|---|---|---|
| 1 | Abandoned-checkout capture + callback | Foorweb, DZ COD Form | STORE-5 |
| 2 | Call-attempt log, callbacks, auto-cancel after N no-answers | DZ COD Form, DZBuild, YouCan Confirm, COD Network | CONF-4, CONF-5 |
| 3 | Phone blocklist, auto-hold repeat refusers | DZ COD Form, DZBuild | CONF-5 |
| 4 | Per-buyer non-delivery risk | DZBuild | exists (`customer_stats`) → STATS-1 |
| 5 | Upsell on the confirmation call | COD Network, YouCan Confirm | CONF-6 |
| 6 | Quantity offers, order bumps, post-order upsell | Lightfunnels, YouCan, DZ COD Form | STORE-3 (offers, bumps); post-order upsell later |
| 7 | Purchase event only after phone confirmation | DZ COD Form | TRACK (setting `purchase trigger`) |
| 8 | Delivered/returned events to Meta | eGrow | TRACK-3 |
| 9 | Stock per variant combination | DZBuild | STORE-1 |
| 10 | Stop-desk picker + carrier rate sync | DZBuild | CARRIER / P1-7 |
| 11 | Bot protection (IP limit, captcha) | DZBuild | STORE-4 |
| 12 | COD remittance reconciliation | eGrow (claim) | ZR-4, Money → Courier cash |
| 13 | AI assistant access (MCP) | YouCan, eGrow | AI |
| 14 | Per-agent performance | DZ COD Form, Codfy, eGrow | exists (Team → Performance) |
| 15 | Return scanning with restock | DZBuild | LATER-1 |
| 16 | Landing-page A/B test | Lightfunnels | LATER-2 |
| 17 | WhatsApp confirmation with SMS/call fallback | eGrow, FlashManager | LATER-3 (WhatsApp API is paid per message) |
| 18 | Card prepayment (CIB / Edahabia / BaridiMob) | DZBuild, Foorweb | LATER-4 (needs a payment provider contract) |
| 19 | Multi-warehouse | eGrow | not planned |

## Where nobody was found doing it (possible differentiators)

- **Agent commission / payroll** — pay per confirmed-and-delivered order,
  computed from the data we already hold. LATER-5.
- **Carrier routing by wilaya success rate** — CARRIER-3.
- **Research → price → validated stock → product page** as one pipeline — RES.
- **Pricing calculator fed by real confirmation/delivery/ad numbers** — PRICE-3.
- **The role wall** (agents never see money, enforced in the database).

## Deliberately not copying

- AI voice/WhatsApp confirmation agent (cost, risk) until the manual flow is solid.
- A cross-merchant customer blacklist: no such shared data exists for us, and
  nothing is shown as a score we cannot compute (D11).
- Eighty shallow carrier tiles; POS and barcode warehouse scope.

## Later ideas (not tasks)

Competitor price watching for research products (needs scraping — legal and
maintenance cost) · post-order one-click upsell · SMS provider · review
requests after delivery · affiliate/marketer links with their own stats.
