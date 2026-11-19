risk: high · surface: ui,security · lane: store

# STORE-2-F — STORE-2 review-4 follow-ups (D40)

Goal: close the open low/medium findings of `docs/briefs/STORE-2.review-4.md` with no migration and no new decision.
Already done (verified in code, do not redo): review-4 #1 (`data.ts:215` uses `Math.max(0, unassigned)`); only its TEST is missing.

## Definition of done
- `getStore()` and the hub / pages-list `store_pages` queries throw on a DB error (hub no longer offers "Create store" on error; error.tsx shows reason + retry).
- `linkPageProduct` on a published page refuses an inactive / no-price product (same check as `setPublished`) and refuses unlinking (spec: published page cannot lose its product).
- App `not-found` CTA goes to the role's home (admin `/app/dashboard`, agent `/app/orders`) and has `metadata.title` "Page not found" (EN/AR keys).
- `createStore` race: the loser's delete result is checked; if it fails return `failed`, not `exists`-with-two-rows; list tie-break stays (created_at, id).
- `liveStoreSlugs` is paginated (`.range` loop, 1000 per page, like data.ts:155), still throws on error.
- Unknown-store 404 under `/s/**` has `<h1>` in the initial HTML (no client-only render).
- AR editor alignment fixed (RTL logical props, `text-start`, no `left/right`) in `page-editor.tsx`.
- Public page lays out correctly at 1280 px (`.store-wrap` max 1120px in `src/components/store/store.css:26`; check hero/gallery/form columns).
- Tests below exist; `scripts/gate.sh` green.

## Files
- `src/app/(app)/app/store/_lib/data.ts`: destructure `error`, throw. `page.tsx` (l.32) and `pages/page.tsx` (l.39): check `error`, throw.
- `src/app/(app)/app/store/actions.ts`: extract the publish check from `setPublished` into `assertPublishable(supabase, productId)`; call from `linkPageProduct` when page status is published (read page `status` first); `createStore` delete result.
- `src/app/(app)/app/not-found.tsx` + `src/messages/{en,ar}.json` (`notFoundPage.*`: neutral `back` label or role-based href via `getProfile()`); add `export const metadata`/`generateMetadata`.
- `src/lib/store/data.ts:252-258`: paginate `liveStoreSlugs`.
- `src/app/(store)/s/not-found.tsx` and its layout: ensure server-rendered h1 (check streaming: not-found in a layout with Suspense may stream after hydration; verify with `curl`).
- `src/components/store/store.css`, `page-editor.tsx`: layout/alignment.
- HTTP status of the agent 404 (200 from layout streaming): informational. Verify once on `next start` that no stack paths reach the RSC payload; document in PROGRESS, no code unless trivial (move the guard into `page.tsx` is NOT required).

## Steps (each committed with step.sh)
1. data errors (`getStore`, hub, pages list) + test.
2. `linkPageProduct` check + test.
3. `createStore` race + `liveStoreSlugs` pagination + tests.
4. not-found (app + store) + i18n parity.
5. CSS/RTL fixes, screenshots.
6. Un-skip-able tests: see below; gate.

## Tests (by name)
- `data.test.ts`: "D54.4 not-assigned below 0 keeps counted sizes available"; "inactive variant stock inside total".
- `admin-guard.test.ts` (extend): "getStore throws on DB error, never returns null"; "editor and preview pages call requireStoreAdmin/getStore for an agent".
- `actions` test: "linkPageProduct to inactive or priceless product on a published page fails"; "createStore loser deletes its row or fails".
- `data-errors.test.ts`: "liveStoreSlugs paginates past 1000 and throws on error".
- Render test: `not-found.tsx` shows title and role-based href.
- `stores.rls.test.ts` (live): "store_pages cross-workspace: agent/admin of ws2 cannot read, insert with ws1 store_id, or relink product of ws1" (needs local DB).
- Agent-session HTTP test (live, local stack): agent cookie GET `/app/store` and `/app/store/pages/<id>` shows not-found body, no store data. `store-http.test.ts` stays opt-in via `STORE_E2E_URL`; ALSO run it once against `next start` and note result in PROGRESS (gate skips it).
- Cache-behaviour test: second `getPublicProductPage` call within 120 s does not re-query; `updateTag("store-public")` busts it (mock `unstable_cache` with a map).

## Screenshots (dark+light, AR+EN)
App: not-found (admin and agent), store hub error state, page editor in AR. Store: `/s/luxe/<slug>` at 1280 px and 390 px; `/s/nope/xx` (view-source for h1).

## Edge cases / assumptions
- A unique one-store-per-workspace index would fix the race cleanly but contradicts "the DB allows several" (spec); NOT added. Needs a DECISIONS row if the owner wants it. Brief stays with the app-level fix.
- Role home: no helper exists (`rbac.ts` only has `requireAdmin` redirect); a neutral label avoids a new helper.
- No new DECISIONS row needed.
