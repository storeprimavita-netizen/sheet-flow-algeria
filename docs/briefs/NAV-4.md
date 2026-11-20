risk: high · surface: ui · lane: shell (+ db migration)

# NAV-4 — Emoji in option labels; label overrides for system statuses (rev 1, after review-0)

Goal: admins give any option an emoji and rename the displayed label of any system status per workspace+language, without touching keys/colors/transitions and without ICU, shared-state or tenant leaks.

## Done when
- `options.emoji` exists (DB-checked); `<Chip>` renders it; all option consumers show it (OptionSelect, order-taxonomy-card, products, sell/orders list, expense table/form).
- Settings → Options has an emoji picker (admin only); Options & labels has a "System status labels" block (EN/AR per kind/key, reset per row).
- `<StatusPill>`/`StatusSelect` show overrides for ALL roles inside /app; /login, store, tracking never read overrides.
- Agents read overrides, cannot write; no finance exposure. Gate green; screenshots clean.

## Decisions taken (no new DECISIONS row: follows AGENTS.md admin-only rule)
- Overrides do NOT go through next-intl/ICU and `src/i18n/request.ts` is NOT touched (review H1, H2, M1). A plain `Record<kind, Record<key,{en,ar}>>` is read in `src/app/(app)/app/layout.tsx` and passed to a client `StatusLabelsProvider`; pill/select read it, `t()` is the fallback. Labels are rendered as plain text (exact round-trip).
- Add column `emoji`; keep `options.icon` (unused, selected in option-sets.ts:40), mark deprecated in DB.md.
- Pill rule: if the displayed label starts with an emoji (`\p{Extended_Pictographic}`) the Lucide icon is hidden; otherwise icon only. Option chips: emoji only, no Lucide. Same for `compact`/`sm`.
- Saved-view emoji out of scope (views not on v3): add `NAV-4-V` (dep CONF-1) in MASTER_PLAN.

## Files
1. `supabase/migrations/00073_option_emoji_status_labels.sql`: `options.emoji text` CHECK (null or one-grapheme-sized, char_length 1..16, no `[[:cntrl:]]`, no U+200B-200F/202A-202E/2066-2069). Replace `o_ins` WITH CHECK: `emoji is null or is_admin()`; update policy already admin. Table `status_label_overrides(id, workspace_id fk, kind text check in STATUS_KINDS list, status_key text check ~ '^[a-z_]{1,40}$', label_en, label_ar, updated_at, unique(workspace_id,kind,status_key))`; label CHECKs: null or 1..40 chars, same forbidden-char regex, at least one non-blank. RLS select = workspace (all roles); insert/update/delete `is_admin()`, update USING+WITH CHECK. `set_updated_at` + `audit_row()`; no anon grants, no authenticated TRUNCATE/TRIGGER/REFERENCES. Update `docs/DB.md`; regen types.
2. `src/lib/status-labels.ts` (server): `getStatusLabelOverrides()` via React `cache()` ONLY (never unstable_cache/"use cache"); try/catch -> `{}`; keys validated against existing `STATUS_KINDS` (statuses.ts:201), build lookup via `Object.hasOwn`/Map, no string concat.
3. `src/components/status-labels-provider.tsx` (client context) + `src/lib/status-label.ts` pure `resolveStatusLabel(overrides, kind, key, locale, fallback)`; wire into `status-pill.tsx`, `status-select.tsx`; grep every `def.label`/`getStatus(`/`status.` consumer (kanban, filters, notifications, customers table headers, aria-label/title); CSV keeps raw keys.
4. `src/components/ui/chip.tsx`: `emoji` prop, `aria-hidden` when label text non-empty (emoji-only override: sr-only default label), `shrink-0`.
5. `src/lib/emoji.ts`: zod `emojiSchema` (trim, `Intl.Segmenter` exactly 1 grapheme, Extended_Pictographic, empty->null); label schema (NFC, trim, strip control/bidi, 1..40).
6. `src/components/fields/emoji-field.tsx`: Radix Popover, arrow-key grid, Escape, accessible names, clear button, 44px cells <640px, RTL flip, paste via fields input, tokens only.
7. `settings/status-labels-section.tsx` + actions in `settings/actions.ts` (zod, admin re-check, `revalidatePath("/app","layout")`; stale labels on soft nav until reload: accepted). Skeleton, placeholder = default label, error+retry, per-row reset, group by kind, AR `dir=rtl`/EN `dir=ltr`, stack at 390px, live `<StatusPill>` preview. Compact form: truncate with `title`/Tooltip (no short override). en/ar keys.
8. MASTER_PLAN: add NAV-4-V.

## Steps (each pushable)
1 migration+DB.md+types · 2 RLS tests · 3 emoji.ts + chip + option reads/actions + consumers · 4 picker · 5 provider+resolve+pill/select · 6 labels UI+actions · 7 screenshots+PROGRESS.

## Tests
- `options.emoji.rls.test.ts`: agent insert with emoji denied, agent update denied; admin ok; bidi/control/>16 emoji rejected even for admin.
- `status-label-overrides.rls.test.ts`: agent select own workspace only, writes denied; bad kind/key rejected for admin; grants (anon none, no TRUNCATE/TRIGGER/REFERENCES); audit row on upsert+delete.
- unit: resolve (en/ar no cross-leak, fallback, unknown kind/key/`__proto__` ignored); label with `'' {x} <i> #` renders exact; pill emoji hides icon (full/compact/sm); chip aria; grapheme boundary; provider absent (store/login) -> defaults; getStatusLabelOverrides returns {} on thrown fetch/no session; en/ar parity.

## Screenshots (dark+light, EN+AR, 1280 and 390)
Settings options + labels, picker open, orders list, order detail workflow, delivery kanban, customers table headers; agent session sees override; /login unaffected.

## Edge cases
Emoji-only override; 40-char label in compact; RTL emoji order; merged option keeps target emoji (say so in confirm dialog); stale overrides for removed keys ignored.
