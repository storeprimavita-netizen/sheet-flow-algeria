# STORE-7 brief — reviews + size guide blocks
risk: high · surface: ui,security · lane: store
(plan row says risk L; a new table + RLS + a public read path makes it high by the AGENTS.md definition, so qa-reviewer applies.)

## Goal
Admin can record real customer reviews (approve/hide) and add a size-guide block to a page; the public product page shows approved reviews (score, cards, rating line) and the size table, from a cost-free DTO.

## Definition of done
- Table `reviews` exists, admin-only RLS, no anon grant; agent session cannot read or write it.
- Only `approved` reviews of the page's own product/workspace reach the public DTO; no `order_id`, `workspace_id`, product id in it.
- The "order confirmed" mark shows only when the linked order is in the same workspace AND `confirmation_status = 'confirmed'` (computed in the DAL, not stored).
- Blocks `sizeguide` and `reviews` validate in `blocksSchema`, are editable in the page editor, render on the store.
- No reviews → no reviews section, no rating line (nothing invented, theme rule 9). Unapproved never counted.
- Approve/create/delete refresh the public page (`invalidateStorePublic`).
- Gate green; EN/AR key parity; screenshots both themes, AR + EN (admin), 390 px + desktop (store).

## Drift found (real code)
- `blocks.ts` has only heading/text/image/list/related; `product-view.tsx` renders them; `page-editor.tsx` hardcodes the 4 addable types (lines ~86, 136, 269) -> extend, do not rewrite.
- `PublicProductPage` (data.ts) is assembled in `assembleProductPage`, shared with admin preview: add reviews there so preview matches.
- Next free migration is 00064. STORE-3 (blocked, unmerged) built its migration on its own branch; renumber whichever merges second.
- `orders` has unique (id, workspace_id) (00026): use a composite FK for `order_id`.
- Store strings: `ar.json` `store.*` (public) vs `store.admin.*` (never reaches public bundle).

## Files
1. `supabase/migrations/00064_reviews.sql`: `reviews(id, workspace_id, product_id, name text 1..80, rating smallint 1..5, body text 1..1000, order_id null, approved bool default false, created_at, updated_at)`. Composite FKs (product_id, workspace_id) -> products on delete cascade, (order_id, workspace_id) -> orders on delete set null (order_id). Index (product_id, approved, created_at desc). Checklist: RLS on; policies sel/ins/upd(USING+WITH CHECK)/del = workspace + `is_admin()`; revoke anon, revoke truncate/trigger/references from authenticated; `set_updated_at`, `workspace_immutable` (reuse `store_workspace_immutable`), `audit_row` triggers. Add row to `docs/DB.md`; regen types (local only).
2. `src/lib/store/blocks.ts`: add `sizeguide` {rows: 1..12 of {size, fits?, shoulders?, chest?, waist?, weight?} text<=40, note?<=300} and `reviews` {} (strict). Text only.
3. `src/lib/store/data.ts`: `PublicReview {name, rating, text, date, verified}`; `loadReviews(db, productId, workspaceId)` approved only, newest first, max 60, plus `reviewSummary {avg(1 dec), count}` over all approved. Fetch order confirmation via one `in()` query scoped by workspace. Errors throw (as the other loaders).
4. `src/components/store/product-view.tsx` (+ `store.css`, `t.ts` keys in `ar.json`): size table in a scroll container; reviews band, cards 3/2/1 cols, first 6 shown, rest inside native `<details>` ("عرض المزيد", no JS); rating line under the title linking `#reviews`, hidden when count 0. Stars via SVG with `aria-label`, theme tokens only, no emoji.
5. `src/app/(app)/app/store/actions.ts`: `createReview`, `setReviewApproved`, `deleteReview`; each `requireAdminProfile()`, zod, session client, `.eq("workspace_id")`, `invalidateStorePublic()`. Optional order number input resolves to an order id of the same workspace.
6. `src/app/(app)/app/store/reviews/page.tsx` + `_components/review-form.tsx` + sidebar/hub link: list by product (Empty with action, loading, error+retry), approve toggle, delete (`DeleteButton`), add form with `components/fields/*`. StatusPill for approved/hidden via `statuses.ts`.
7. `page-editor.tsx`: add-size-guide (row grid editor) and add-reviews-block buttons; EN/AR admin keys.

## Steps (each `scripts/step.sh`)
1 migration + types + DB.md + RLS test · 2 blocks schema + tests · 3 DAL loaders + tests · 4 public rendering + css + strings · 5 actions + tests · 6 reviews admin page · 7 editor blocks · 8 screenshots/self-critique, PROGRESS.

## Acceptance tests (names)
- `reviews RLS: agent cannot select/insert/update/delete`; `reviews RLS: other-workspace admin sees nothing`; `reviews: order from another workspace is refused by the FK`.
- `public DTO: unapproved review never returned`; `public DTO has no order_id/workspace_id/product_id on reviews`; `verified mark only for confirmed order of same workspace`; `summary counts only approved`; `no reviews -> section and rating line absent`.
- `blocks: sizeguide rejects html-looking overflow / >12 rows / unknown keys`; `unpublished page still 404`.
- `actions: agent session refused`, `createReview rejects rating 0/6, body empty`; mutation invalidates cache tag.
- Screens: /app/store/reviews (empty, populated, error), page editor with both blocks, preview and `/s/<store>/<page>` at 390 px and 1280 px, light + dark (admin), AR + EN (admin).

## Edge cases / assumptions
- No public review submission in this task (a public form = abuse surface; needs STORE-4 rate-limit work). Reviews are entered by the admin from real customer messages. Confirm in the brief review; if the owner wants customer-submitted reviews that is a new DECISIONS row.
- Review text is data: rendered as text only, never HTML; names stripped of emoji with `stripEmoji` on the store (no emoji on store).
- Product deleted -> reviews cascade; order deleted -> `order_id` nulled, badge disappears.
- Reviews load only for pages whose product is active (existing gate), no extra public query when product has none.
- Cache: reviews change only via actions (tag invalidated), so no stale-by-trigger concern.
- No new DECISIONS row needed; no new dependency.
