# CARRIER — delivery carriers

Goal: confirmed orders go to a carrier from inside the platform and their
status comes back by itself — ZR Express today (done: push, Svix webhooks,
catch-up cron, stale guard), other Algerian carriers next. D9 stands: shipment
status is authoritative from the carrier; agents never set it.

## What exists (do not rebuild)

`src/lib/integrations/zrexpress*.ts`, `zr_shipments`, `zr_territories`,
`apply_zr_state`, `/api/webhooks/zrexpress`, `/api/cron/zr-sync`, prod-API
guard D13. Audit: `docs/ZR_EXPRESS_API_AUDIT.md`. Open ZR items keep their
ids: ZR-3 (customer history), ZR-4 (payments ledger), P0-8 (stock undo when an
order leaves returned), P1-7 (delivery prices per wilaya × type, D14).

## Carrier interface (CARRIER-1)

Extract, from the working ZR code, the smallest interface a second carrier
needs — and only when the second carrier is being built:

```
createParcel(order) → { parcelId, tracking }      trackParcel(id) → { state, occurredAt, situation }
listTerritories() → wilayas/communes/desks        getRates() → wilaya × home|stopdesk
verifyWebhook(req) | poll(since)                  mapState(carrierState) → delivery_status
```

`shipments` generalises `zr_shipments` (carrier, parcel_id, tracking, state,
state_slug, occurred_at, situation) with unique (workspace, carrier,
parcel_id); the stale-event guard and "live reads only win ties" rule from
`apply_zr_state` apply to every carrier. Orders get `carrier`. A carrier's
credentials live in `integration_configs` (admin-only).

## Next carriers (each needs the owner's account + the official docs)

| Carrier | What third-party sources say (*verify* against official docs) |
|---|---|
| Yalidine | `api.yalidine.app/v1`, API id + token, parcels editable only while "en préparation", histories, wilayas/communes/centers/fees, per-second/minute/hour/day quotas; webhooks unconfirmed → plan on polling |
| EcoTrack family (DHD, Conexlog, ~80 couriers) | one host per courier `https://<courier>.ecotrack.dz/api/v1`, bearer token — one adapter covers many couriers |
| Maystro | `Authorization: Token …`; create order, label URL, wilayas, communes, rates |
| Noest | API token + user GUID; desks by `station_code`; orders arrive as drafts until validated |
| Procolis (legacy ZR, Abex, Leopard…) | token + key |

Order: Yalidine first (largest), then EcoTrack (widest), others on demand.
Do deep integrations, not eighty shallow tiles.

## Routing (CARRIER-3, differentiator — no competitor found doing it)

Per order, suggest the carrier by rule: wilaya success rate per carrier
(STATS), delivery type availability, price. Admin sets the rule; the agent
sees the suggestion on confirm, admin may override. Starts as "default
carrier per wilaya" before any automatic scoring.

## Also

- Wilaya reference: the store copy says 69 wilayas, the `wilayas` table has
  58. CARRIER-0 reconciles it against the carrier territory trees (ZR sync is
  the source) and updates `wilayas` + `wilaya_fees` seeding. Never hard-code
  the count.
- Stop-desk picker: desks per wilaya from the carrier, shown in the order
  sheet and the store form.
- Labels: carrier label URL on the order; bulk print list.
- No real parcels from dev or preview (D13 pattern for every carrier).

## Tasks

CARRIER-0 wilaya reconciliation · P1-7 delivery prices · P0-8 stock undo ·
ZR-3 · ZR-4 · CARRIER-1 interface + `shipments` (when the second carrier
starts) · CARRIER-2 Yalidine · CARRIER-3 routing rules · CARRIER-4 EcoTrack.
