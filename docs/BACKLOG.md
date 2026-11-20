# Backlog — low-severity review findings

Not tasks. One line each: task id · file · what. Cleaned up in a batch when the
owner asks, or when a feature area is next touched.

STORE-3 · src/components/store/product-view.tsx · sold-out covers sized products only; unsized product with stock <= 0 still says "orders open soon", JSON-LD has no availability (STORE-4 must reuse one shared check)
STORE-3 · src/components/store/product-view.tsx · sold-out card also replaces orderSlot in the admin preview; state it is intended
STORE-3 · src/components/store/*.test.tsx · no dedicated sold-out render test (all sizes out: offers hidden, card shown)
STORE-3 · src/components/store/store.css · dark "save 23%" badge contrast below 4.5:1
STORE-3 · src/components/store/size-chips · out-of-stock sizes only struck out; no visible label
STORE-3 · supabase/migrations/00077 · renumbered from 00051 at merge; a remote that already has 00055+ needs `db push --include-all` (owner)
STORE-3 · src/lib/store/form-fields · integerInput("2500,00") -> 250000 (review-3 #6)
STORE-3 · order-form · "save X" label must follow the chosen size (#9)
STORE-3 · src/lib/store/data.ts · related cards load in one batch of queries (#10)
STORE-3 · app chrome · touch targets under 44 px in the 390 preview (#11)
STORE-3 · selling/actions · curl 404 status on a production build; AR save-error gender; sale price above compare price saved through the product action untested
CONF-1 · src/app/(app)/app/sell/orders/saved-view-bar.tsx · Save does not cancel the waiting search write when the saved search is unchanged (review-4 #3)
CONF-1 · src/components/fields/search-param-sync.ts · `pairKey` joins decoded pairs with `&`, so typing `a&status=x` matches an outside `q=a&status=x`; compare JSON.stringify of sorted entries (review-4 #4)
CONF-1 · src/components/fields/search-param-sync.ts · a navigation slower than the 5 s hold can outlast it (review-4 #5, not reproduced live)
CONF-1 · confirmation/shipping pages · search with no match shows "Queue is empty" plus New order instead of "no match" and a clear action (review-4 #6, pre-existing; also in CONF-1-F)
