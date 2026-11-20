risk: high · surface: ui · lane: shell (+ db migration 00074)

# NAV-4-F — NAV-4 review-3 LOW findings 1-9 and missing tests

Goal: close every LOW from `docs/briefs/NAV-4.review-3.md` (1-9) and add its 4 missing tests, without changing NAV-4 behaviour. Point 10 (anon grants on `options`) is NAV-4-S, not here.

## Done when
- A label of only U+3164/U+FEFF/U+061C/U+2028/U+00AD/U+034F/U+115F is rejected by zod and by the DB CHECK; ZWJ emoji in a label survive.
- `options.emoji` CHECK rejects non-emoji text ('ABCDEFGHIJ'); picker emoji, flags and keycaps still accepted.
- `saveStatusLabel` writes only the submitted language; two admins editing EN and AR of one row do not overwrite each other.
- Preview and server use ONE normaliser (`normalizeLabel` in `src/lib/emoji.ts`).
- /app layout and customer page have no serial overrides round-trip. Pill is not truncated inside select triggers. A leading emoji has a gap. AR toast clears the topbar. Picker a11y names fixed.
- 4 missing tests exist and pass; `scripts/gate.sh` green; screenshots clean.

## Files
1. `supabase/migrations/00074_nav4_label_emoji_hardening.sql` (next after 00073): drop and re-add `options_emoji_chk`, `sl_en_chk`, `sl_ar_chk`. Label regex adds `؜﻿  ­͏ᅟㅤ` to the 00073 set; ZWJ (200D) stays legal in labels (00073 labels class `​-‏` wrongly bans it: split to `​‌‎‏`). Emoji CHECK adds a positive test: `emoji ~ E'[©®‼⁉™ℹ←-⇿⌚-⏿Ⓜ▪-◾☀-➿⤴⤵⬀-⯿〰〽㊗㊙\U0001F000-\U0001FAFF]' or emoji ~ E'[\U0001F1E6-\U0001F1FF]{2}' or emoji ~ E'[0-9#*]️?⃣'` (superset of the JS regex; defence in depth). No new table, so no RLS/grants change; existing rows must pass (check dev data; the re-add validates). Update `docs/DB.md` rows 78-79. No type regen (no column change).
2. `src/lib/emoji.ts`: extend `FORBIDDEN` with the new code points but NOT ZWJ; add exported `normalizeLabel(v)` (NFC, strip FORBIDDEN, trim) used by `labelSchema`. Also reject a label whose graphemes are all invisible (Default_Ignorable): `\p{Default_Ignorable_Code_Point}` strip then require non-empty.
3. `settings/status-labels-section.tsx:57`: preview draft uses `normalizeLabel`.
4. `settings/actions.ts` `saveStatusLabel`: take `{kind,key,lang:'en'|'ar',value}` shape OR keep both fields but only send the changed language; per-language update: `update ... set label_<lang>` on existing row, else insert. Delete the row only when both columns end up null (read-after-write in one RPC is overkill: do `update`, then `delete ... where label_en is null and label_ar is null`). `resetStatusLabel` stays a delete. Keep admin re-check and zod. Update the row component to send the dirty language only.
5. `src/app/(app)/app/layout.tsx:21`: start `getStatusLabelOverrides()` in the same `Promise.all` as the counts. `sell/customers/[id]/page.tsx:39-40`: put overrides, `getProfile`, `isCurrentUserAdmin` and the other awaits in one `Promise.all`.
6. `status-pill.tsx`: drop `max-w-[9rem] truncate` when rendered inside select triggers (add a `truncate` prop, default off, set by `compact` table cells only) and put `title={text}` on the pill. Leading emoji: in `Chip`/pill render `startsWithEmoji` text as `<span>{first grapheme}</span> <rest>` with `gap-1`; use `Intl.Segmenter` helper `splitLeadingEmoji` in emoji.ts.
7. `src/app/(app)/layout.tsx:37`: Toaster `offset`/`mobileOffset` below the topbar (token height), check RTL.
8. `fields/emoji-field.tsx`: roving tabindex (one `tabIndex=0` cell, others -1), cell `aria-label` as emoji name via `Intl.DisplayNames`-free list (add a short name map in messages `settings.options.emojiNames.*`) or generic "Emoji N of 36"; trigger `aria-label` includes the current value and option name (prop `label`); label inputs in status-labels-section get `aria-label` with status name + language. en/ar keys, parity.

## Steps
1 migration+DB.md · 2 emoji.ts/normalizeLabel + unit tests · 3 per-language action + preview + action tests · 4 layout/customers parallelism · 5 pill/chip + toaster · 6 picker a11y · 7 screenshots + PROGRESS.

## Tests (by name)
- `nav4.rls.test.ts`: "label CHECK rejects U+061C, U+FEFF, U+2028, U+3164"; "label CHECK keeps ZWJ emoji"; "emoji CHECK rejects plain text, accepts flag, keycap, ZWJ family".
- `emoji.test.ts`: normalizeLabel parity with DB set; invisible-only label invalid; `splitLeadingEmoji`.
- `settings/status-labels-actions.test.ts` (mock rbac like `fees-actions.test.ts`): agent calling `saveStatusLabel`, `resetStatusLabel`, `setOptionEmoji` rejected before any DB call; per-language save sends only that column.
- `status-pill.test.tsx`: "server-render smoke": a server component importing StatusPill renders via `renderToStaticMarkup` (catches a lost `"use client"`); no truncate class in select trigger; gap span for leading emoji.
- RLS (live): two sequential per-language saves keep both labels.

## Screenshots (dark+light, EN+AR)
Settings labels (1280, 390, saved toast in AR), delivery kanban card select ("Wait for deposit" full), orders list pills with leading emoji, picker open + keyboard focus ring.

## Edge cases / assumptions
- Review-3 file lines are still accurate (checked layout.tsx:21, customers page:39, pill truncate). Tests nav4.rls and status-pill.test already exist: extend, do not duplicate.
- Re-adding CHECKs fails if a dev row holds a now-banned char: query first, fix data in the migration with `update ... regexp_replace` only for the new set.
- Emoji CHECK ranges are a superset (accepts a few symbols such as arrows); the JS schema stays the strict gate. State this in DB.md.
- No new DECISIONS row needed.
