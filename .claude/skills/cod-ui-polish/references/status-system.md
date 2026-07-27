# Status system

One source of truth: `lib/statuses.ts`. One renderer: `<StatusPill status={...} kind="confirmation|delivery|product|task" />` = colored dot + icon + label, in a tinted background with a strong foreground. The same pill appears in table cells, detail sheets, filter chips, **and inside select triggers and every select option**.

## Confirmation

| Key | Label | Token | Icon |
|---|---|---|---|
| `wait_for_confirmation` | Wait for confirmation | neutral | `clock` |
| `no_answer` | No answer | warning | `phone-missed` |
| `closed_phone` | Closed phone | warning (deeper) | `phone-off` |
| `cancelled` | Cancelled | danger | `x-circle` |
| `confirmed` | Confirmed | success | `check-circle-2` |

## Delivery

| Key | Label | Token | Icon |
|---|---|---|---|
| `wait_for_deposit` | Wait for deposit | neutral | `package` |
| `bureau_deposited` | Bureau deposited | info | `building-2` |
| `in_transit` | In transit | info (deeper) | `truck` |
| `out_for_delivery` | Out for delivery | info (brightest) | `navigation` |
| `stop_desk_waiting` | Stop desk waiting | info-violet | `map-pin` |
| `delivered` | Delivered | success | `check-check` |
| `delayed` | Delayed | warning | `clock-alert` |
| `cancelled` | Cancelled | danger | `x-circle` |
| `returning` | Returning | warning (deeper) | `corner-up-left` |
| `returned` | Returned | danger (deeper) | `undo-2` |

## Product

`to_be_tested` neutral `flask-conical` · `tested` info `beaker` · `confirmed` success `badge-check` · `cancelled` danger `ban`

## Task

`todo` neutral `circle` · `doing` info `circle-dot` · `blocked` danger `octagon-alert` · `done` success `circle-check`

## Rules

- Each status entry exports: `key`, `label`, `token`, `icon`, `next[]` (allowed transitions), `terminal` (bool), `requiresConfirm` (bool).
- Only `next[]` transitions are offered in the UI. Illegal transitions are not rendered, not disabled-and-confusing.
- `requiresConfirm` (cancelled, returned) shows a confirm dialog naming the order. Everything else applies optimistically with a toast and undo.
- Every change writes to `order_status_history` and the audit log. The order detail sheet shows that history as a vertical timeline with the actor, timestamp, and duration spent in the previous stage.
- Risk score badge follows the same visual grammar: green `shield-check` / amber `shield-alert` / red `shield-x`, with the reason on hover ("3 returns / 7 orders").
- Source badges: Shopify, LightFunnels, Manual — small outlined chips with distinct icons, never colored like statuses (they aren't state).
