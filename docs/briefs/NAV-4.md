risk: high · surface: ui · lane: shell (+ db migration)

# NAV-4 — Emoji in option labels; label overrides for system statuses

Goal: admins can give any option an emoji shown before its label everywhere it renders, and rename the displayed label of any system status per workspace and language (keys, colors, transitions fixed).

## Done when
- `options.emoji` (nullable text, max 1 grapheme cluster/16 chars) exists; `<Chip>` renders it before the label; every option consumer shows it (OptionSelect, order-taxonomy-card, products page, sell/orders list, expense table/form).
- Settings → Options: emoji picker per option (create + edit); empty = none.
- Settings → Options & labels gets a "System status labels" block: per kind/key, EN and AR override, empty = default i18n label. Admin only.
- `<StatusPill>`/`StatusSelect` show the override (full and `compact` short form) for ALL roles; falls back to i18n.
- Agents see overrides but cannot write; no cost/finance exposure.
- Gate green; screenshots clean.

## Facts found
- `options` (00014) already has unused `icon text`; policies: all read, insert any, update/delete admin. Audit trigger exists. Types generated: regen after migration.
- `settings` is admin-only (AGENTS.md), so overrides CANNOT live there: agents render StatusPill. Use a new table.
- `StatusPill` is the single renderer (`src/components/status-pill.tsx`), uses `t(def.label)`; labels also used by StatusSelect, kanban, filters (grep `getStatus(` / `def.label` / `status.short.`).
- next-intl messages come from `src/i18n/request.ts` (static JSON). Cleanest injection: merge overrides into `messages` there (keys `status.<group>.<key>` and `status.short.*`) — zero call-site changes. Needs a per-request cached read (service-free, session client, RLS) and must not break unauthenticated routes (/login, store): no workspace => skip.
- Saved views do NOT exist on `v3` (only on blocked `v3-CONF-1`). Saved-view emoji is therefore out of scope here: add task `NAV-4-V` (dep CONF-1) in MASTER_PLAN. Not a new decision.
- Emoji policy: user-authored content only, never on store; override labels allow emoji (reference navigation-ia.md).

## Files
1. `supabase/migrations/00073_option_emoji_status_labels.sql`: `alter table options add column emoji text check (emoji is null or char_length(emoji) between 1 and 16)`; `create table status_label_overrides (id, workspace_id fk, kind text, status_key text, label_en text, label_ar text, updated_at, unique(workspace_id,kind,status_key), check at least one label non-blank, length ≤ 40)`. RLS: select = `workspace_id = current_workspace_id()` (all roles); insert/update/delete admin (`is_admin()`), update has USING + WITH CHECK. `set_updated_at` + `audit_row()` triggers; grants: no anon, no authenticated TRUNCATE/TRIGGER/REFERENCES. Add to `docs/DB.md`; regen types.
2. `src/lib/statuses.ts`: export `STATUS_KINDS` key list used to validate (kind,key) pairs.
3. `src/lib/status-labels.ts` (+ actions colocated in `settings/actions.ts`): `getStatusLabelOverrides()` cached per request; zod-validated upsert/clear actions, admin re-check, trim, strip control chars, `revalidatePath`.
4. `src/i18n/request.ts`: merge overrides into messages for the active locale.
5. `src/components/ui/chip.tsx`: optional `emoji` prop before label (`aria-hidden` off; plain text, `shrink-0`).
6. `src/lib/option-sets*.ts`, `options-section.tsx`, `option-select.tsx` and consumers: select/return/render `emoji`; `emoji-picker` field in `components/fields/` (small curated grid + free paste input; no new dependency).
7. `settings/status-labels-section.tsx` + tab entry + en/ar keys.
8. MASTER_PLAN: add NAV-4-V.

## Steps (each pushable)
1 migration + DB.md + types · 2 RLS test · 3 chip emoji + option reads/actions + consumers · 4 picker in Options settings · 5 status-label read + i18n merge + pill · 6 labels settings UI + actions · 7 screenshots + PROGRESS.

## Tests
- `src/lib/options.emoji.rls.test.ts`: agent can read, cannot update emoji; admin can.
- `src/lib/status-label-overrides.rls.test.ts`: agent selects own workspace rows, insert/update/delete denied; other workspace invisible; blank/over-length rejected.
- unit: override merge (en/ar, fallback, unknown kind/key ignored); chip renders emoji; action zod rejects bad kind/key.

## Screenshots
Settings options + status labels; orders list, order detail workflow, delivery kanban with an override and an emoji option; dark+light, EN+AR (RTL), 1280 and 390 px; agent login sees override.

## Edge cases
- Override with emoji only; long labels truncate with tooltip; RTL ordering of emoji before label; AR override must not leak into EN.
- Merged option: keep emoji of target. Empty string normalised to NULL.
- Hardcoded status text outside StatusPill (e.g. filters, CSV export) — grep and route through same messages; exports keep default keys.
- Labels are data: render as text only, never HTML or ICU-format (escape `{}`/`'` in merged messages to avoid next-intl format errors).

No new DECISIONS row needed (table choice follows AGENTS.md admin-only rule).
