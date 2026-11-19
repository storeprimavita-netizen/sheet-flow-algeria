VERDICT: FIX

## Summary
Reviewers: qa-reviewer (owasp-security) + ui-reviewer, on `git diff v3...v3-STORE-1-F`.
Migration 00065 matches the brief: lock first with the same key as the save fn, deletes moved before upserts with `in_use` still refused, grants/invoker/search_path kept. Live suites green (variants 30/30, cash/audit/stock-stages/rls 116/116, gate `--fast` OK once).
One medium gap: a product with 0 options still accepts value-less sizes, which later lock the editor (the state review-4 #4 asked to close).
UI not verified in a browser by the reviewers; screenshots are 390 px only.

## Findings (ranked)

1. **Medium** — `supabase/migrations/00065_variant_config_hardening.sql:86-96`, `src/lib/variants.ts:63`.
   Failure: the new-size check compares key count with `jsonb_array_length(v_opts)`; with 0 options, `values: {}` passes (zod too, 0 === 0). Reproduced as admin in a rolled-back tx: save `{options:[], variants:[{A,{}},{B,{}}]}` creates 2 value-less sizes; a second save adding option "Size" succeeds (existing sizes skip the check, stale check only looks at value rows, completeness trigger ignores value-less sizes). The editor then loads `{}` and zod `variant_values` refuses every later save — options editor stuck.
   Fix: SQL refuses a new size when the payload has 0 options (`incomplete size`); zod refuses variants when `options` is empty; the option set is locked (stale/refuse) once any `product_variants` row exists, matching the editor's `locked`. Add tests.

2. **Low** — `00065:90-91`. `"values": null` (direct RPC only) hits `jsonb_object_keys` on a scalar → generic `failed`, not `incomplete size`. Fix: `jsonb_typeof(a.v->'values') is distinct from 'object'` → raise `incomplete size`.

3. **Low** — `src/lib/variants.rls.test.ts:521-537`. Reserved-stage test asserts nothing moves, while the brief said "held moves M to L". Correct under D34 (reserved is derived per product, 00031; no per-size reserved count), but the deviation is unstated and no-movement is not proven. Fix: add `expect(await moves(o)).toEqual([])` and a comment citing D34.

4. **Low** — `src/lib/variants.rls.test.ts` ("re-adding a removed label in one save"). First block only asserts the 23503 refusal; the real case is the last block. Split into two named tests for readability.

5. **Low** — screenshots in `docs/design/audit/STORE-1-F/`: 6 images, all 390 px, one theme/locale pair each. Brief asks dark+light × EN+AR at 1280 and 390 for order detail, product edit, `/products/new`, stock hub, count-by-size. Fix: capture the missing set and self-critique.

6. **Low** — `src/app/(app)/app/orders/[id]/variant-card.tsx`: h2 "Size" with a field label "Size" directly under it. Consider `aria-labelledby` the heading instead of a visible duplicate label. `variants-editor.tsx:152-165` value buttons still fall back to `optionName`, not the new `option N` fallback — make consistent.

7. **Low** — `variants-editor.tsx:271` unsaved hint has no live region (acceptable as a persistent hint). `product-form.tsx:120-122`: confirm in browser the variants editor is hidden on `/products/new` so the "add after first save" notice does not contradict the page.

8. **Low (follow-up, out of brief scope)** — `src/lib/integrations/zrexpress-sync.test.ts:83`, `src/lib/orders.order_seq.rls.test.ts:60` still delete workspaces directly (same 40P01 risk, now more likely as the trigger takes the advisory lock on cascaded option deletes). Swap to `deleteWorkspaces` or log a task.

Notes: order breadcrumb skip is correct (`PageHeader` has no breadcrumb prop) — ensure it is noted. `src/lib/rls.test.ts` delivery-agent change is outside the listed files but harmless. `incomplete size` maps to `invalid` (no raw error leak). en/ar parity holds; no hardcoded colors.

## Missing tests
- 0-option save with `values: {}` refused.
- Adding an option refused when value-less sizes exist (or such sizes cannot exist).
- `values: null` via RPC → `incomplete size`.
- Reserved-stage test asserts no `stock_movements` row written.
- Gate green 3x in a row (`--fast`) — only 1 run observed.
