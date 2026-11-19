# Specs (v3) — what to build and why

One file per epic. A task in `docs/MASTER_PLAN.md` names its spec; read only
that one. A spec states owner intent, decisions, the data model sketch and the
rules a brief may not break. The brief (`docs/briefs/<id>.md`) says how.
`docs/SPEC.md` (v2) still describes what already exists; where a v3 spec
disagrees with it, v3 wins.

| Spec | Epic | Owner asked for |
|---|---|---|
| `NAV.md` | Navigation & clarity | "the main problem is the way of navigation… interconnected sections not clear" |
| `CONF.md` | Confirmation workspace | views, kanban, customer score on hover, easy work for agents |
| `PRICE.md` | Pricing calculator v2 | automatic calculator, scenarios, markup % and 99 rounding |
| `RES.md` | Product research | spied products, categories, test → validated → product page |
| `STORE.md` | Native store | store like Shopify/Lightfunnels, dynamic form per product, variants and offers |
| `TRACK.md` | Pixels & Conversions API | Meta/TikTok, event_id dedup, send confirmed/delivered/returned |
| `CARRIER.md` | Delivery carriers | ZR Express and other Algerian carriers |
| `MONEY.md` | Two accounts | DZD and USDT, manual logs |
| `NOTIF.md` | Notifications | in-app + Telegram for tasks, meetings, orders |
| `STATS.md` | Statistics | customer score, wilaya confirmation/delivery, seasons |
| `AI.md` | AI connector (MCP) | connect Claude, ChatGPT, Antigravity to analyse the data |
| `GROW.md` | Channel, spam shield, SEO/AIEO, upsells, live visitors | order source = Facebook/TikTok/Google…, IP blocking, be found on Google and AI, upsell/downsell/mix, live visitors on the map |
| `IDEAS.md` | Competitor-inspired features | "suggest me other features" |

Facts taken from the web (competitors, carrier APIs, Meta/TikTok rules, MCP
client requirements) were read on 2026-11-17 and are marked *verify* where the
source was a vendor page rather than official documentation. A brief that
depends on a *verify* fact must re-check it against the official docs first.
