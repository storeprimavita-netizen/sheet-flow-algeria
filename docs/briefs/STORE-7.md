# STORE-7 brief — reviews + size guide blocks (rev 1, after review-0 FIX)
risk: high · surface: ui,security · lane: store
(plan says L; new table + RLS + public read path = high.)

## Goal
Admin records real customer reviews (approve/hide) and adds a size-guide block; the public page shows approved reviews and the size table from a cost-free DTO.

## Definition of done
- `reviews` table: admin-only RLS, no anon grant; agents denied (select/write).
- Public DTO: approved only, no order_id/workspace_id/product_id; name = first name + initial; name and body emoji-stripped (fallback label if empty).
- Verified ("order confirmed") only if order.product_id = review.product_id AND confirmation_status='confirmed' AND excluded_reason IS NULL, same workspace. Checked in createReview and recomputed in the DAL; orders query selects id, product_id, confirmation_status, excluded_reason only.
- `sizeguide`/`reviews` blocks: max one of each (blocksSchema refine); rating line only if a reviews block exists AND approved count > 0; no reviews -> nothing rendered.
- Mutations check affected rows (`.select("id")`, data.length) and call `invalidateStorePublic()`.
- Gate green, EN/AR parity, screenshots done.

## Drift (real code)
- blocks.ts: heading/text/image/list/related; `text()` is min(1). page-editor.tsx `add()` ternary (~86), label (~136), hardcoded list (~266) fall through to `list`: replace with exhaustive `switch` + `never`.
- `assembleProductPage` is shared with the admin preview: add reviews there (approved only, same DTO). Expect a merge conflict with STORE-3.
- Next migration 00064 (STORE-3 used 00051). Composite unique on orders (00026) for FK. `store_workspace_immutable` exists (00049).
- `order_number` is the external ref (nullable, not unique); staff see `order_seq` (00050). Resolve by order_seq + workspace_id; unknown -> visible "order not found" error.
- statuses.ts has only STORE_STATUS; add a `review` kind (approved=success, hidden=neutral) + i18n; check STATUS_KINDS consumers.

## Files
1. `supabase/migrations/00064_reviews.sql`: reviews(id, workspace_id, product_id, name, rating smallint, body, order_id null, approved default false, created_at, updated_at). CHECKs: rating 1..5, trimmed non-empty, name<=80, body<=1000. Composite FKs product (cascade), order (set null order_id). Indexes (product_id, approved, created_at desc), (order_id, workspace_id). RLS on; sel/ins/upd(USING+WITH CHECK)/del = workspace + is_admin(); `revoke all from anon, authenticated` then grant s/i/u/d; triggers set_updated_at, store_workspace_immutable, audit_row. DB.md row; regen types (local).
2. `blocks.ts`: sizeguide {title?<=80, rows 1..12 of strict {size, fits?, shoulders?, chest?, waist?, weight?} <=40, note?<=300}; `""` preprocessed to undefined; columns empty in every row hidden; units in i18n headers. reviews {} strict. Refine: <=1 each.
3. `data.ts`: PublicReview {name, rating, text, date, verified}; loadReviews approved, newest, max 60; summary {avg, count} from plain rating fetch (no PostgREST aggregate); label count from summary, list = latest 60. Throws on error.
4. `product-view.tsx`, `store.css`, `t.ts`, ar.json: sizeguide and reviews as full-width `.store-section` siblings (like related), explicit BlockView cases, excluded from the `.store-blocks` emptiness check. Table: real `<table>`, `<caption>`, `th scope`, wrapper role=region tabindex=0 aria-label overflow-x:auto, `<bdi>` for Latin/numbers. Reviews: cards 3/2/1, first 6 then `<details>` (summary >= 44px), `id=reviews` + scroll-margin-block-start >= sticky header, body overflow-wrap:anywhere, `<time datetime>`. Stars aria-hidden SVG + one `.store-sr` text; digits in --ink-muted/--gold-text. Rating link min-block-size var(--tap). Verified: text label (order confirmed, never "purchase") + thin icon. Plural-aware count via Intl.PluralRules (AR). JSON-LD aggregateRating optional, keep `<` escaping.
5. `app/store/actions.ts`: createReview/setReviewApproved/deleteReview: requireAdminProfile, zod, session client, workspace eq, row-count check, invalidate. Never prefill name from customer_name.
6. `app/store/reviews/page.tsx` + `_components`: crumbs Store > Reviews, sidebar link (hidden for agents), route guard redirects agents, purpose line, product combobox + approved/hidden filter via search params, capped list, rows link product/order, stars + number aria-label, StatusPill review, approve via setting-switch with reviewer name label + pending + error toast, DeleteButton; loading/error (or inherited), three empty states. Form: rating radiogroup (arrows, 44px), counters 80/1000, optional order_seq, "customer agreed" checkbox.
7. `page-editor.tsx`: size grid editor (card per row at 390px, per-cell labels, add/remove/reorder with accessible names, live-region moves); reviews block hint + link to /app/store/reviews.

## Steps
1 migration+types+DB.md+RLS test · 2 blocks schema+tests · 3 statuses kind · 4 DAL+tests · 5 public rendering/css/strings · 6 actions+tests · 7 admin reviews page · 8 editor · 9 screenshots, PROGRESS, note in docs/QUESTIONS.md that no public submission is intended.

## Acceptance tests
- reviews RLS: agent denied; other-workspace admin sees nothing; anon denied; cross-workspace order refused by FK.
- verified refused: other product's order, excluded_reason order, cancelled order; createReview resolves order_seq and shows error for another workspace's seq.
- public DTO: unapproved never; no ids; no emoji; first name + initial; summary approved only; admin preview equals public.
- blocks: blank optional cells save; 2nd reviews/sizeguide rejected; >12 rows, unknown keys rejected.
- no reviews block -> no rating line; block with 0 approved -> nothing; unpublished page 404.
- actions: agent refused; rating 0/6, empty body rejected; 0-row update errors; tag invalidated.
- Screens: /app/store/reviews (3 empties, populated, error), editor, preview and public at 390/320/1280, light+dark, AR+EN, RTL grid order, 1000-char Arabic body, 6-col table, keyboard pass.

## Assumptions
No public submission (owner confirmation recorded in QUESTIONS.md; else new DECISIONS row). No new dependency.
