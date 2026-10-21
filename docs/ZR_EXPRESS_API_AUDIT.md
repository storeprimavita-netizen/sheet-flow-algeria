# ZR Express API audit (2026-10-21)

**Sources inspected (official, public, fetched as markdown):** `https://docs.zrexpress.app` — index `llms.txt`; guides `docs/getting-started`, `authentication`, `webhooks`, `webhook-event-types`, `webhook-payload-reference`, `webhook-integration-guide`, `webhooks-vs-polling-a-comparison`; references `reference/{createparcelendpoint, getparcelbyidsupplierendpoint, searchsupplierparcelsendpoint, getparcelstatehistorysupplierendpoint, searchworkflowsendpoint, searchcustomersendpoint, getcustomerendpoint, getsupplierstatsamountendpoint, gettransactionsstatscurrentsupplierendpoint, searchsupplierpaymentscurrentsupplierendpoint, getsupplierpaymentcurrentsupplierendpoint, acceptsupplierpaymentendpoint, searchtreasurytransactions…bysupplierpaymentidendpoint}`.
**Not reachable:** the URL named in the brief, `zrexpress.com/ZREXPRESS_WEB/FR/Developpement.awp` (legacy Procolis site), returned HTTP 403. `zrexpress.net` marketing page was read: it links an API reference but publishes no reliability figure. The existing client already targets the new platform (`api.zrexpress.app`, docs.zrexpress.app). **No call was made to the live API** — everything below is documentation, not observed behavior. Response bodies were not inspected, only OpenAPI schemas.

## 1. Authentication & conventions
- Header `X-Api-Key: <token>` plus `X-Tenant: <tenantId>` (both used by `src/lib/integrations/zrexpress.ts`). Docs/authentication.
- Tokens are created in the ZR portal (API Rest → Token API); **validity 7/30/90/180/365 days**, shown once. → MNW needs a token-expiry reminder (not implemented).
- Base `https://api.zrexpress.app/api/v1`. Role-gated: parcel reads need `SupplierAdminRole`/`SupplierParcelsManagerRole`; whether our token has the roles needed for treasury endpoints is **unverified**.
- Search endpoints are `POST …/search` with `{pageNumber (from 1), pageSize, orderBy, keyword, advancedSearch{fields,keyword}, advancedFilter{logic AND|OR, filters[], field, operator(eq,neq,contains,gt,gte,lt,lte,…), value}}`; responses `{items, pageNumber, pageSize, totalCount, totalPages, hasNext, hasPrevious}`. (docs/getting-started)
- Rate limits: docs state polling "is subject to rate limiting" and webhooks have none (docs/webhooks-vs-polling); **no numeric limit is published**. Treat as unknown → sequential calls, backoff on 429.

## 2. Endpoint inventory used or needed by MNW
| Purpose | Method + path | Used by MNW feature | Status |
|---|---|---|---|
| Create parcel | POST `/parcels` (`externalId`, `amount`, customer, address, products, `deliveryType` home\|pickup-point) | Send to ZR | in use |
| Get parcel / by tracking | GET `/parcels/{id}`; by tracking number endpoint | refresh status | in use (id) |
| List parcels | POST `/parcels/search` (filter by `customer.phone.number1`, state, dates; `includeProducts`) | own-history lookup, sync catch-up | **new** |
| Parcel state history | `getparcelstatehistorysupplier` | audit, out-of-order repair | new |
| Workflows/states/situations | POST `/workflows/search` | authoritative state list for this tenant (incl. return/refund states) | **new, needed first** |
| Webhook endpoint CRUD + secret | POST `/webhooks/endpoints`, GET `…/{id}/secret` | live status | in use |
| Supplier balance | GET `/supplier-payment/supplier-balance` → `{totalAmountPaid, totalAmountReadyToBePaid, totalAmountNotCashed, totalAmountCashed}` | "money with ZR" cross-check | new; **field semantics undocumented** |
| Transactions stats | GET `/supplier-payment/stats/current-supplier` → `{amount}` | cross-check | new; semantics undocumented |
| Supplier payments (remittances) | POST `/supplier-payment/search`; POST `/supplier-payment/{id}/details` → `{id, amount, totalParcelsDelivered, totalParcelsCancelled, totalRefundsCredited, totalRefundsDebited, totalItemLabeling, labelingAmount, storage, createdAt, acceptedAt, referenceId, status}` | "money received" ledger | new; **`status` values undocumented** |
| Payment line items | POST `/treasury-transactions/search/supplier-payment/by-supplier-payment/{id}` → `{id, amount, weightCost, comment, type, parcel{parcelId, trackingNumber, deliveryPrice, returnPrice, type…}, createdAt, cashReceiptId, supplierPaymentId, supplierPaymentReference}` | parcel↔payment reconciliation, no double count | new; `type` values undocumented |
| Accept payment | PUT `/supplier-payment/{id}` | merchant acknowledges payout (**write — never call without owner OK**) | not planned |
| Customers | POST `/customers/search`, GET `/customers/{id}` → `{id,name,phone,addresses,deliveryPreference,instruction…}` | none | CRUD only |
| Reports | `searchreports`, `downloadreportbyid` | possible fallback export | unread |
| Update parcel state | `updateparcelstateendpoint` | MNW must NOT drive delivery states | unused |

## 3. Official parcel states (docs/searchworkflows, "Core Workflow States")
`commande_recue` (supplier created) → `en_traitement` → `appel_confirmation` → `commande_confirmee` → `en_preparation` → `pret_a_expedier` → `confirme_au_bureau` → `dispatch` / `vers_wilaya` → `en_livraison` → `sortie_en_livraison` → **`livre`** ("handed over to the customer and payment received (if COD)", Driver) → **`encaisse`** ("Payment validated and deposited at the hub", Finance) → **`recouvert`** ("Funds cleared for supplier payout", Finance).
Situations (sub-status): call attempts/unreachable/cancelled (confirmation), wrong commune/postponed/changed to StopDesk/refused (delivery), awaiting customer/SMS sent (StopDesk). Special states: exchange pending, refund re-injected, restocked. **The exact return/failed-delivery state slugs are not in the prose table** — the live `workflows/search` response for our tenant is the source of truth (existing `zr_state_map` setting maps by state *name*).
Webhook events: `parcel.state.updated`, `parcel.state.situation.created`, `parcel.isReturn.updated`; envelope `{eventType, occurredAt, data: ParcelWebhookDto}` with `state{id,name,…}`, `situation{slug…}`, `lastStateUpdateAt`, `amount`, `deliveryPrice`, `returnPrice`, `isReturn`, `externalId`. Svix-signed; "events may occasionally arrive out of order — use `occurredAt`"; idempotency key; 4xx = no retry. (docs/webhook-event-types, payload-reference, integration-guide)

## 4. Customer reliability percentage — **NOT FOUND in the API**
- Customer endpoints return only the merchant's own customer records (name, phone, addresses, preferences). No delivered/total counts, score or percentage anywhere in the customers, parcels or treasury schemas read. The word "reliability/fiabilité" appears nowhere in docs.zrexpress.app (grep over all downloaded pages); the marketing site shows none either.
- Therefore **no ZR reliability score can be displayed**; scope (global vs merchant-only), formula and minimum history are unknown. Whatever ZR's dashboard shows is not proven reachable through our token.
- Options (decision needed): (a) ask ZR support whether a customer-score endpoint exists (smallest owner action); (b) a clearly labelled **"Your ZR history for this phone"** computed from `POST /parcels/search` filtered by `customer.phone.number1` (delivered vs returned/cancelled counts on *our own tenant only*), never called a ZR score; (c) MNW's own order-history metric (also labelled separately). (b)/(c) are fallbacks, not the requested feature.

## 5. Collections & remittance — what is verifiable
- **Per parcel:** state `livre` ≠ `encaisse` ≠ `recouvert` (see §3). Parcel `amount` is the COD amount; `deliveryPrice`/`returnPrice` are fees.
- **Per remittance:** `SupplierPayment` (amount, refunds credited/debited, labeling, storage, `acceptedAt`, `referenceId`, `status`) with parcel-level `treasury-transactions` — this is the official payout record; `acceptedAt` is the merchant acknowledgement.
- **Balance:** four undocumented fields. Hypothesis only (verify against real data before use): NotCashed≈delivered not yet encaisse, Cashed≈encaisse, ReadyToBePaid≈recouvert, Paid≈paid out.
- **Brief vs docs:** the brief counts only `Encaisse` as collected. ZR's `recouvert` is the *next* state (funds cleared for payout, still unpaid), so a parcel leaves `encaisse` for `recouvert` while ZR still holds the money. Counting only `encaisse` would make money vanish from "with ZR" before it is paid. **Proposed rule:** collected-and-unpaid = parcels in `encaisse` or `recouvert` not yet on an accepted SupplierPayment; `livre` never counts. **Needs owner confirmation.**
- Net amount to us ≠ sum of parcel amounts (delivery/return fees, refunds, labeling, storage deducted): use SupplierPayment.amount for "received", parcel amounts only for "with ZR (gross)".

## 6. Proposed formulas & test cases (to implement after owner confirms and a read-only probe verifies fields)
- `with_zr_gross = Σ parcel.amount where state ∈ {encaisse, recouvert} and parcel not in any supplier_payment line`
- `received_api = Σ SupplierPayment.amount where acceptedAt not null` ; `received_manual = Σ manual receipts` (separate column, flagged, unique reference)
- `discrepancy = ZR supplier-balance (mapped fields) − local ledger`, shown, never auto-overwritten; unavailable ⇒ "unavailable", not 0.
- Tests: livre-not-encaisse excluded; encaisse counted once across repeated syncs/webhooks (unique parcel id); encaisse→recouvert transition does not change the total; parcel added to a payment leaves "with ZR"; reversal/return decreases; manual receipt duplicate rejected; API failure ≠ zero.

## 7. Blocked / unverified (smallest owner action)
1. Live responses: run the read-only probe (to be added: `scripts/zr-probe.ts`, redacted) with the production token for `workflows/search`, `supplier-payment/supplier-balance`, `supplier-payment/search`, one `parcels/search`. Needs owner to run it with credentials (or paste redacted output).
2. Token roles: confirm the token has SupplierAdmin/ParcelsManager rights for treasury endpoints.
3. Ask ZR support: (a) customer reliability endpoint? (b) meaning of the four balance fields and `SupplierPayment.status`/transaction `type` values; (c) rate limits; (d) test tenant/sandbox.
4. Token expiry (7–365 days) — set a reminder.

## 8. Findings in the existing integration
- `zrexpress-webhook.ts` writes `state_updated_at = now()` and updates `delivery_status` unconditionally — **no comparison with the event's `occurredAt`/`lastStateUpdateAt`**, so an out-of-order older event can overwrite a newer state (violates addendum §5). Fix in the status task.
- States are matched by *name* via `zr_state_map`; `encaisse`/`recouvert` appear nowhere in src or migrations, so no collection state is tracked yet.
- `getZRParcel` only reads `{id, trackingNumber, state.name}`; amounts/situation/`isReturn` are discarded.
