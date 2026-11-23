VERDICT: PASS
Reviewer model: claude-opus and codex ui-reviewer

## Summary

The defensive review checked the seeded views, live function grants, legacy and note-preserving transitions, scoped card data and user-role behavior. Independent UI review covered Confirmation, Shipping and All, including the legacy Shipping URL, Arabic grouping, mobile status selection and pending search retention. The full build gate passed with 1,406 tests and live RLS.

## Findings

- **Low · `00088_order_view_kanban.sql` and `sell/orders/actions.ts`.** The board checks swap state before the RPC locks the row. For status-only transitions, check the display-only swap rule under the same lock so a concurrent swap cannot be overwritten by a board move.
- **Low · `sell/orders/actions.ts`.** English database message matching controls which translated rejection is shown. Use stable error codes.
- **Low · `sell/orders/order-kanban.tsx`.** A prior move error can stay visible after authoritative props show a different status. Clear stale retries when the card state changes.

## Coverage gaps

- Verify a swap-race guard, legacy `swap_order` behavior after migration, missing-workspace denial, and specific error classification with stable codes.
- The independent reviewer used eight representative screenshots and confirmed read-only Shipping for the delivery role. Full visual matrix, drag, dialog focus, save/reset, and loading and error states were outside the independent checks. Builder evidence and its limits are in PROGRESS.
