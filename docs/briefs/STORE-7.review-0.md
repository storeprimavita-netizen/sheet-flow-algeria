VERDICT: FIX

## Summary
Brief review (qa-reviewer + ui-reviewer). Facts in the brief hold (00026 composite unique, 00049 `store_workspace_immutable`, next migration 00064, page-editor lines 86/136/269, preview shares `assembleProductPage`).
No high security hole, but the design has gaps that would ship wrong behaviour: the verified mark can be faked with any confirmed order, "order number" targets the wrong column, sparse size tables fail to save, and where the new blocks render is undefined.
Amend the brief with the fixes below, then build.

## Findings (ranked)

1. **HIGH (ui) — block placement undefined; renders inside `.store-blocks`** — brief §4, `src/components/store/store.css:66` (`max-inline-size:70ch`, list/pre-line styles), `product-view.tsx:85` (`blocks.some(b => b.type !== "related")` emits an empty `store-blocks` section on a page with only new blocks). Cards 3/2/1 and a 6-col table get squeezed/mis-styled. Fix: render `sizeguide` and `reviews` as their own full-width `.store-section` siblings (like `.store-related`, theme bands 6/7); add explicit cases in `BlockView` (no `default: null` fallthrough); exclude them from the `store-blocks` emptiness check.

2. **MEDIUM (security/integrity) — verified mark attachable to any confirmed order** — brief §3/§5, DoD line 11. Admin can link a confirmed order of another product, or a test/excluded order; the badge claims a purchase that did not happen (theme rule 9). Fix: verified only when `o.product_id = review.product_id AND o.confirmation_status = 'confirmed' AND o.excluded_reason IS NULL`; check in `createReview` and recompute in the DAL; the orders query selects only `id, product_id, confirmation_status, excluded_reason` (no PII).

3. **MEDIUM — "order number" resolves the wrong column** — brief §5; `supabase/migrations/00050_order_seq.sql:1-2`. `order_number` is the external platform ref (nullable, not unique); staff see `order_seq` (#0001, unique per workspace). Fix: resolve by `order_seq` + `workspace_id`; return a visible "order not found" error, never ignore silently.

4. **MEDIUM — blank size-table cells fail validation** — brief §2, `src/lib/store/blocks.ts` `text()` is `min(1)`. The row-grid editor sends `""` for blank optional cells → save returns invalid. Fix: preprocess `""` → `undefined`; `.strict()` per row; hide columns empty in every row; add an optional block `title` (used as table `<caption>`); units live in i18n header strings, not data.

5. **MEDIUM — duplicate blocks / rating line without a target** — brief §2/§4. Two `reviews` blocks → duplicate `id="reviews"`; rating line links `#reviews` even when the page has no reviews block. Fix: `blocksSchema` refine: at most one `reviews` and one `sizeguide`; show rating line only when the reviews block exists AND approved count > 0. Test both.

6. **MEDIUM — page-editor `add()` ternary falls through to `list`** — `page-editor.tsx:86` (also :136 label ternary, :266 hardcoded list). Adding new types without rewriting silently creates lists. Fix: `switch` with exhaustive `never` check; size-guide grid stacks as a card per row at 390 px, per-cell labels (not placeholder-only), add/remove/reorder with accessible names, same live-region move pattern; reviews block shows a hint + link to `/app/store/reviews`.

7. **MEDIUM — customer names published without consent** — `PublicReview.name`. Real names on an indexable page. Fix: public DTO shows first name + initial (or admin form "customer agreed" checkbox); never prefill from `orders.customer_name`.

8. **MEDIUM (ui) — status source** — brief §6; `src/lib/statuses.ts:186-198` has `STORE_STATUS` (draft/live/published) only. Fix: add a `review` kind (approved=success, hidden=neutral, distinct icons) to `StatusKind`/`STATUS_KINDS` + i18n; do not reuse `published`; check consumers of `STATUS_KINDS`.

9. **MEDIUM (ui) — admin reviews page under-specified** — brief §6. Fix: crumbs Store > Reviews, sidebar active state, one-line purpose, product combobox + approved/hidden filter via search params, capped/paginated list, rows link to product/order, rating stars + number with aria-label; nested `loading.tsx`/`error.tsx` (or confirm inheritance from `store/`); three empty states (no reviews, no filter match, no product pages); route guard redirects agents (not only RLS), sidebar link hidden for agents. Form: rating as a radio group (`role=radiogroup`, arrows, 44 px) or fields component, counters 80/1000, state dialog vs inline. Approve toggle via `setting-switch` with accessible name incl. reviewer name, pending state + error toast.

10. **MEDIUM (ui/a11y) — rating line, stars, details, table** — brief §4. Rating link `min-block-size:var(--tap)`; `#reviews` needs `scroll-margin-block-start` ≥ sticky header; stars `aria-hidden` SVG + one `.store-sr` text (not aria-label per star); readable digits in `--ink-muted`/`--gold-text`, not `--gold`; `<summary>` ≥ 44 px; size table = real `<table>` with `<caption>`, `th scope`, wrapper `overflow-x:auto; tabindex=0; role=region; aria-label`, no page-level horizontal scroll at 390/320 px; `<bdi>` for Latin sizes/numbers; `overflow-wrap:anywhere` on review body.

11. **LOW — summary vs 60 cap and aggregates** — DTO caps 60 but summary counts all approved; PostgREST aggregates are off by default. Fix: fetch ratings plainly (or RPC) for the summary; label count from summary, list = latest 60.

12. **LOW — Arabic plurals** — "N تقييمات" needs plural forms; `st()` in `t.ts` only substitutes `{n}`. Fix: plural-aware helper (Intl.PluralRules) for the count string.

13. **LOW — emoji in body** — only `name` is `stripEmoji`'d; theme rule 6 = no emoji on store. Strip body too in the DAL; fallback label if name strips to empty.

14. **LOW — verified copy** — wording must say order confirmed, not "purchase"/delivery; text label + thin icon, not colour only; date via `<time datetime>`.

15. **LOW — migration hardening** — add index `reviews(order_id, workspace_id)` (FK set-null scans); `revoke all … from anon, authenticated` then grant s/i/u/d (PG17 MAINTAIN); SQL CHECKs on rating/name/body length + trimmed non-empty. Note: STORE-3 uses `00051` (gap), not 00064 — fix the brief's drift note; expect an `assembleProductPage` merge conflict.

16. **LOW — actions must check affected rows** — `setReviewApproved`/`deleteReview` check `data.length` after `.select("id")` (as `savePage`), since RLS silently matches 0 rows.

17. **LOW — JSON-LD** — if `aggregateRating` is added at `src/app/(store)/s/[store]/[slug]/page.tsx:54`, keep `<` escaping and DTO fields only.

## Missing tests
- Verified refused for: order of a different product; confirmed order with `excluded_reason`; cancelled order. (Cross-workspace test only proves the FK.)
- `createReview` resolves `order_seq` (not `order_number`); refuses another workspace's seq with a visible error.
- Public DTO names/bodies contain no emoji; name is first name + initial (if chosen).
- Size guide with blank optional cells saves; second `reviews`/`sizeguide` block rejected.
- Page with approved reviews but no `reviews` block → no rating line; reviews block with 0 approved → nothing rendered.
- Admin preview (session client) returns approved-only, same as public DTO.
- Anon key select on `reviews` denied; agent redirected from `/app/store/reviews`.
- Screens: keyboard pass (summary, table region, rating link, rating control, grid editor); star/verified contrast in both store themes; 390 + 320 px with 1000-char Arabic body and 6-col table; RTL admin grid order.
- Record in `docs/QUESTIONS.md` the owner confirmation that no public review submission is intended.
