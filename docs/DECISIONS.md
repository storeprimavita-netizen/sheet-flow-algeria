# Decisions (launch push, 2026-10-21)

| # | Decision | Why / rejected alternatives |
|---|---|---|
| D1 | Workflow = existing analyse/execute conventions; Verify (independent agent review) and Ship (build+test+secret scan+push) are inline steps. No new skill files. | Repo only has bootstrap/analyse/execute (Phase-14-specific). Owner approved. |
| D2 | Scrubbed `kimi.tx` + debug zip from the 104 unpushed commits (filter-repo, backup tag + bundle). origin untouched. | Alternatives: separate clone, or skip GitHub. Owner approved local rewrite. |
| D3 | Charts stay hand-rolled server SVG/CSS. No chart library. | Council C/D: none installed, d3-geo only; bundle weight. |
| D4 | One KPI contract computed in SQL (`kpi_lines`), returning numerator/denominator/matured flag; `pricing.ts` keeps margin/break-even only. Definitions in `docs/council/B-kpi.md`. | B: rates duplicated in 5 places, cohort mismatches. Rejected: patching each site. |
| D5 | ROI = net_profit / total_costs. ROAS stays separate and labelled. | Prompt §4. |
| D6 | Lightfunnels stays as an inert incoming integration (enum kept). MNW product pages become the native channel and must not depend on it. | E: removal buys nothing, enum can't be dropped, history uses it. |
| D7 | Meta Ads = P2, built against mocked Graph fixtures; real sync blocked on owner credentials. Facts from third-party blogs must be verified against Meta docs first. | E. |
| D8 | **SUPERSEDED by D9–D10** (owner replied with a role hybrid, then the ZR addendum removed the delivery-agent premise). | – |
| D9 | **No internal delivery agent.** Confirmation agents confirm; after "Send to ZR", shipment status is authoritative from ZR (verified Svix webhooks + scheduled `parcels/search`/`parcels/{id}` catch-up). Confirmation agents and any legacy `delivery_agent` user can NEVER set delivery_status; only service-role ZR sync and admin corrections (audited, shown as "MNW correction" separately from `zr_shipments.state`). Stale events (`occurredAt` older than stored state) are ignored. Legacy enum value, policies and the `assigned_delivery_agent` column are KEPT (additive, reversible); the role is simply dropped from invite UI and from queues. | Addendum §2. Production user roles could not be inspected from here — owner to confirm no live delivery_agent users before UI removal. |
| D10 | **Permission matrix (replaces D8 middle path).** Admin: any valid transition, audited. Confirmation agent: confirmation-stage transitions only (retry, reschedule, cancel, confirm, recover backwards), orders in the confirmation queue/own assignment only; sees sale_price, quantity, delivery_fee (to quote COD total); cannot edit customer name/phone/address/assignment/wilaya (DB guard, not UI); no cost/profit/ads/finance. Legacy delivery_agent: read-only on shipped orders (COD amount only). Webhook/ZR sync: service role. Tests via real authenticated sessions (direct PostgREST/RPC). Implement as one migration + rls.test.ts cases (P0-4). | Owner D8 reply + addendum §2. |
| D11 | ZR reliability % is **not in the documented API** (docs/ZR_EXPRESS_API_AUDIT.md §4). Nothing is shown as a "ZR score". Pending: ZR support answer. Fallback (separately labelled): "your ZR history for this phone" from `parcels/search` on our own tenant; MNW-own history metric second. | Addendum §3: do not fabricate. |
| D12 | Money-with-ZR rule: `livre` never counts; collected-unpaid = `encaisse` ∪ `recouvert` parcels not yet on a SupplierPayment (ZR's `recouvert` follows `encaisse` and is still unpaid). **Deviates from "Encaisse only" in the addendum — awaiting owner confirmation.** Received = SupplierPayment.acceptedAt (API) + flagged manual receipts. Balance endpoint is a cross-check only; its field semantics are undocumented. Finance totals are not built until a read-only live probe confirms fields. | Addendum §4; audit §5. |

## Final permission matrix (migration 00025, enforced in Postgres; tests in src/lib/rls.test.ts)
| Capability | Admin | Confirmation agent | Legacy delivery agent | Service role (ZR/webhooks) |
|---|---|---|---|---|
| See orders | all | open queue (wait_for_confirmation/no_answer/closed_phone) + orders assigned to them (auto-assigned when they act) | confirmed orders, read-only | all |
| Price / qty / delivery fee | see + edit | see (quote COD total), never edit | see | – |
| Cost, profit, ads, finance, settings | yes | no (RLS, unchanged) | no | – |
| Customer name/phone/address/commune/wilaya/delivery type | edit | **no (column allow-list, default-deny for new columns)** | no | webhook fills |
| Assignment | edit (UI + bulk) | no; only auto-self-assign inside the transition RPC | no | – |
| confirmation_status | any, audited | any value via RPC while order is in their queue and not yet handed to delivery (recovery/backward allowed) | no | – |
| delivery_status | any, audited (an MNW correction, separate from ZR's `zr_shipments.state`) | **never** | **never** | ZR sync (authoritative) |
| Orders already pushed to ZR / past wait_for_deposit | any | untouchable | – | – |
| Direct attempts count / comment / cancellation reason | yes | yes (allow-listed) | no | – |
Exceptional transitions: admin-only (delivered/returned corrections). Legacy `delivery_agent` enum, column and rows are retained; role leaves invite UI in ZR-2.
