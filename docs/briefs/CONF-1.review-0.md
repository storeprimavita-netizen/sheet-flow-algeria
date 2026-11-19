VERDICT: FIX

## Summary
Brief review (design, before code) by qa-reviewer and ui-reviewer. Static review: nothing is built and no screenshots were taken. The local DB was checked read-only.
The DB/RLS shape is sound. There are 4 highs: a "Today confirmed" seed that can't be expressed, a SECURITY DEFINER seed callable over RPC, `TabsNav` reuse that hides views from agents, and an unspecified view UX (hierarchy, dirty/save flow, shared vs personal, four states).
Everything can be fixed in the brief. The open choices below have a recommended default, so `/decide` can settle them without blocking. Revise the brief, then build.

## Findings (ranked)

### High
1. **The "Today confirmed" seed can't be built as written.** Location: Drift §1/§4. `orders` has no confirmed-at column. The only record of confirmation time is `order_status_history` (see the `confirmed_at` derivation in `00020_analytics_timing.sql:23`). Config only allows absolute `from`/`to`, which cannot express "today". **Fix:** add a relative date token (`confirmed_on: "today"`, Africa/Algiers), backed by a history join or SQL function. Otherwise defer this seed like "Callbacks due". Also state the scope of every seed (which page each one appears on).
2. **Any user can call the seed function.** Location: Migration §Seed. In this DB, `pg_default_acl` grants EXECUTE on new public functions to `anon` and `authenticated`. An authenticated user could call a SECURITY DEFINER `seed_order_views(ws)` over RPC with another workspace's id and insert shared views there. **Fix:** write out `revoke execute … from public, anon, authenticated` (the pattern at `00021…sql:43-44`). Keep the `workspaces` trigger wrapper as a separate function (the 00050 pattern). Test that an authenticated RPC call is refused.
3. **`TabsNav` can't be reused, and it would hide views from agents.** Location: Files, `view-tabs.tsx`. `src/components/tabs-nav.tsx:17` returns null for non-admins, and it is a server component. Agents are the main users of confirmation views. **Fix:** build a client `ViewTabs` with no admin gate. Use `<nav aria-label>` with links and `aria-current="page"`. Use no `role=tablist` unless arrow keys are implemented. Put the menu trigger beside each link, not inside it (a button inside `<a>` is invalid HTML).
4. **View IA and UX are unspecified, so the builder would have to invent them.** Location: Files / Screenshots.
   - **Hierarchy.** Views directly under `OrderTabs` in the same underline style leave users unable to tell "which queue" from "which filter". Render views as a second-level pill/chip strip in the toolbar row, labelled "Views", and check it against navigation-ia.md.
   - **Dirty state.** Define dirty as normalized URL params differing from the view config, ignoring `page`. Show a dot plus a text "Modified" badge (not color alone). Show a Save / Save as / Reset bar only when the view is dirty.
   - **Switching views.** Switching tabs drops unsaved edits. Say so, or confirm first.
   - **Shared vs personal.**
     - Mark shared views with a Lucide icon and an aria-label. Group shared views first, then personal, with a separator.
     - Agents get no edit menu on shared views, only "Save as mine".
     - Admin "Save as" asks explicitly whether the view is shared or personal (labelled radio).
   - **Menu.** A Radix menu with Rename, Delete (existing `DeleteButton` confirm), and Move earlier / Move later (keyboard-accessible, logical in RTL). Its trigger's accessible name includes the view name. Say whether shared and personal views share one position sequence.
   - **Name dialog.** Name field with a 60-character counter, emoji field, and an inline duplicate-name error (map 23505).
   - **Four states.**
     - Loading: a Suspense skeleton of 3 pills.
     - Empty personal group: "Save current filters as a view" action.
     - Views query fails: the page still renders "Default", plus "Could not load views" with Retry.
     - Populated.
   - The Default tab (no `?view`) is always present and can't be deleted. On confirmation it shows today's `ACTIONABLE_CONFIRMATION` queue.

### Medium
5. **The immutability trigger can let NULL through.** Location: Migration §RLS. Written with `<>`, `null <> uid` is NULL and the trigger passes. That lets an admin make a shared view private or share a private one. Agents never reach the trigger because WITH CHECK blocks them first. **Fix:** use `IS DISTINCT FROM` for `owner_id` and `workspace_id`. Test the admin flip in both directions, plus a `workspace_id` change.
6. **"Link reproduces the same list" fails for private views.** Location: Done-when §4. A teammate opening `?view=<someone's private id>` falls back to Default, and their filters mix with the URL params. **Fix (recommended default):** only shared views are linkable by id. "Copy link" on a personal view puts the full effective config in the URL. Refuse a view whose scope doesn't match the page. Check the id is a valid uuid before querying. Show an inline, dismissible `role=status` notice ("That view is not available"; it does not reveal whether the id exists), and strip the bad `?view` from the URL. Do the same when the active view was deleted.
7. **Each page's fixed filter must stay.** Location: Drift §3. Delivery's `.eq(confirmation_status,'confirmed')` is never replaced by a view. On confirmation, a view's status filter may only narrow within non-confirmed statuses. This is about consistency, not a leak: orders RLS (00025) still limits agents.
8. **Writes RLS blocks fail silently.** Location: Files, `views-actions.ts`. When RLS blocks an UPDATE or DELETE, PostgREST returns 0 rows and no error, so an agent's Save or Reorder on a shared view would look successful. **Fix:**
   - Call `.select()` and require exactly one row. Otherwise return an error, show it inline with Retry, and keep the dirty state.
   - Set `owner_id` and `workspace_id` on the server, never from the form.
   - After a create, `router.replace` to the new `?view`.
   - When two edits collide, the last write wins; write that down.
9. **Config values are not validated, only keys.** Location: Drift §4. `q` and `agent` go into raw `.or()` strings (`all/page.tsx:70-82`). **Fix:**
   - Type every value: uuid regex, enum, wilaya int range, ISO date.
   - Pass `q` through `sanitizeOrderTextQuery`.
   - `sort` must use the `SORT_COLUMNS` allow-list.
   - Put this in one shared query builder used by all three pages.
   - `columns` may only toggle columns the page already shows. Money stays gated by role, never by config.
10. **Re-seeding by name, and English-only names.** Location: Migration §Seed. CONF-2 and CONF-4 will re-run the seed. Deduplicating on `lower(name)` brings back seeds an admin deleted and duplicates ones they renamed. Seed names stored as English text also show in English to Arabic users. **Fix (recommended default):** add a nullable `seed_key` with unique `(workspace_id, seed_key)`. Seed idempotently on the key. Show the translated label (messages) until the view is renamed. A deleted seed stays deleted: record it with a tombstone, or seed only on workspace creation and in a migration's one-time backfill.
11. **No way to clear a filter the view sets.** Location: Pages. "URL overrides the view" can't remove, say, `duplicates=1`. **Fix:** define an explicit cleared value (e.g. `__all`). Reset reloads the saved config. `page` resets when filters change.
12. **Tab overflow, RTL and a11y are not specified.** Location: Screenshots.
    - The strip scrolls horizontally, keeps the active tab in view, and has a fade at the edge, mirrored in RTL.
    - Tap targets are at least 44 px on mobile.
    - Wrap user names in `<bdi>`/`dir="auto"`.
    - Focus is visible. Escape returns focus to the trigger. After deleting the active view, focus moves to Default.
    - A live region announces Saved / Reset.
    - Cap views per scope (e.g. 20, enforced in the action).

### Low
- Filter key names in the brief (`status`, `product`, `wilaya`) don't match the code (`confirmation_status`, `product_id`, `wilaya_code`). Use the code names.
- Emoji `≤8`: some single emoji are longer than 8 characters. Allow about 16 characters and validate one grapheme. Seeds and the shared marker use Lucide icons, never emoji.
- The `name` check should use `btrim`. Use `octet_length(config::text)` instead of `pg_column_size`. Revoke table grants from `anon`. Add `workspace_id … on delete cascade`.
- Confirmation and delivery queries have no limit. A broad view is cut at PostgREST's 1000-row maximum without notice. Add paging or a notice.
- "Columns" appears in the Goal and Done-when, but no column chooser exists. Either say `config.columns` is stored and ignored for now, or drop it. The UI ignores or refuses `layout='kanban'` until CONF-2.
- 00056 will apply before 00051 (parked on STORE-3) on the remote push. Tell the owner.
- AGENTS.md says to generate types with `--linked`, the brief says `--db-url`. Follow the project's local-only rule and state which one is used.
- List the new i18n keys (dirty, save, save as, reset, rename, delete, move, shared, not-available notice, error/retry, empty, confirm).

## Choices for `/decide` (recommended default in brackets)
- Seed names: translated through `seed_key`, or English only [`seed_key`].
- Deleted or renamed seeds: do they come back? [no].
- Linking private views [shared views by id only; personal views link through their full params].
- "Today confirmed": build it or defer it [build it with a relative token through status history, or defer if that grows past this task].
- Agents' personal views: on every scope, or confirmation only [every scope they can open; orders RLS still applies].
- Cap on views per scope [20].

## Missing tests
- **RLS / DB:**
  - anon reads nothing;
  - the seed RPC is refused for `authenticated`;
  - an admin `owner_id` flip is refused in both directions, and so is a `workspace_id` change;
  - an agent's update or delete of a shared view changes 0 rows, and the action reports an error;
  - seed idempotent by `seed_key`;
  - a deleted seed is not recreated.
- **Unit:**
  - every seeded config parses through `viewConfigSchema` without losing keys;
  - `.or()` injection strings (`,` `)` `%`) in URL and stored `q`/`agent`;
  - an unknown sort falls back;
  - junk `?view` (non-uuid, another user's private view, another scope's view);
  - URL params override the view, including the cleared value;
  - dirty detection ignores `page`;
  - duplicate name maps to a readable error;
  - an oversized name or emoji is rejected.
- **Pages:**
  - delivery still filters on confirmed, whatever the view;
  - an agent opening an admin's `?view` link on `all` still sees only agent-visible orders.
- **UI:**
  - keyboard path through the tab strip and menu, including Escape;
  - an agent sees no edit menu on shared views;
  - focus after delete.
- **Screenshots** (add to the brief, store under `docs/design/audit/CONF-1/`):
  - the views row under `OrderTabs`, for admin and agent;
  - the dirty bar;
  - the name dialog with a duplicate error;
  - the delete confirmation;
  - shared and personal groups;
  - AR with a Latin-named view;
  - 12 or more views at 390 px in RTL;
  - the invalid-view notice;
  - the error and empty states;
  - both themes.
