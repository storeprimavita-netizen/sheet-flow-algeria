VERDICT: FIX

## Summary
Brief review (review-0) by qa-reviewer + ui-reviewer (static; no app run, no SQL).
Design is sound, but the i18n merge in `src/i18n/request.ts` is unsafe as written
(shared module mutation, global hot path, no failure fallback), ICU escaping loses
text, the DB does not enforce emoji/label sanitisation against direct PostgREST
inserts, and the new UI widgets lack a11y/four-state specs. Amend the brief, then build.

## Findings

### HIGH
1. **Cross-tenant leak via mutated message module** — `src/i18n/request.ts:12-15`.
   `(await import("../messages/en.json")).default` is one object per server process;
   any in-place/deep merge persists overrides into later requests (other workspaces,
   /login). Fix: brief must say "build a new object; shallow-copy `status` and touched
   groups only; never mutate the import". Test: merge(A) then merge(none) → second
   result and base JSON unchanged.
2. **Global hot path + failure breaks every page** — `src/i18n/request.ts` (brief item 4).
   Runs for /login, reset-password, store, tracking. Expired JWT / network error would
   throw and take down unauthenticated pages; DB read adds latency everywhere. Fix:
   skip when no auth cookie/session or no workspace; try/catch → static messages;
   React `cache()` only — never `unstable_cache`/`"use cache"` (pattern exists in
   `src/lib/store/data.ts`; a key without workspace+user leaks across tenants).
   Preferred alternative (see M1): overlay in the `(app)` layout instead of request.ts.
   State explicitly that store/tracking keep default labels; add a test.
3. **Pill shows two glyphs (Lucide icon + override emoji)** — `src/components/status-pill.tsx`,
   `src/components/ui/chip.tsx`. navigation-ia.md says status pills use Lucide icons
   only while allowing emoji in override labels; brief does not reconcile. Fix: pick
   one rule (e.g. label starting with emoji hides the Lucide icon, or keep both with a
   defined gap), cover in unit test and screenshots incl. `compact` and `size="sm"`.

### MEDIUM
1. **ICU escaping corrupts labels** — brief "strip control chars" + merge into
   next-intl messages. Measured with next-intl 4.13.4: `a''b`→`a'b`, `'{x}'`→`{x}`;
   quote-escaping turns `#1 <i>` into `'#'1 <i>`. Fix (preferred): keep overrides out
   of ICU — StatusPill/StatusSelect read a plain override map (context provided by the
   app layout), `t()` only as fallback. Alternative: reject `{ } < > # '` in zod and a
   DB CHECK. Test: label → render → exact equality round-trip.
2. **Sanitisation bypass via direct PostgREST** — `supabase/migrations/00014_option_sets.sql:62-66`
   (`o_ins` lets any role insert). An agent can insert `emoji` with bidi/zero-width/
   control chars or 16 letters; action-level stripping is skipped. Fix: DB CHECK on
   `emoji`, `label_en`, `label_ar` rejecting `[[:cntrl:]]`, U+200B–200F, U+202A–202E,
   U+2066–2069; change `o_ins` WITH CHECK to `emoji is null or is_admin()` (picker is
   admin-only). Test: agent insert with emoji denied; bidi emoji rejected even for admin.
3. **Grapheme limit not enforced** — brief Files 1. `char_length ≤ 16` ≠ 1 grapheme.
   Fix: zod with `Intl.Segmenter` (exactly one segment, `\p{Extended_Pictographic}`),
   trimmed-empty → NULL; NFC-normalise labels.
4. **Duplicate column** — `00014_option_sets.sql:32` has unused `options.icon`
   (selected in `src/lib/option-sets.ts:40`); brief adds `emoji` beside it. Fix: decide
   in the brief — reuse `icon`, or add `emoji` and mark `icon` deprecated in `docs/DB.md`.
5. **Emoji `aria-hidden` off** — `chip.tsx` (brief item 5). Screen readers announce
   "red circle …" before every option. Fix: `aria-hidden` when label text non-empty;
   for emoji-only override labels provide a visually-hidden default label.
6. **Emoji picker unspecified** — brief item 6. Specify: Radix Popover, arrow-key grid
   nav, Escape, accessible names for trigger and cells, clear button, focus ring, 44px
   cells on mobile, RTL flip, free-paste via `components/fields` input (no raw
   `<input>`), token colors only.
7. **Status-labels section lacks four states and layout spec** — brief item 7. Add
   loading skeleton, default state (placeholder = default i18n label), save error with
   reason + retry, per-row reset-to-default, group by kind, AR input `dir="rtl"`/EN
   `dir="ltr"`, rows stack at 390px; live preview with the real `<StatusPill>`.
8. **Compact/short form** — one override for full and short; `status.short.*` exists
   only for confirmation/delivery. A 40-char label breaks narrow Status columns. Fix:
   truncate in compact with `title`/Tooltip (or add an optional short override).

### LOW
1. No DB check on `kind`/`status_key`: add `kind in (...)` and `status_key ~ '^[a-z_]{1,40}$'`;
   validate the pair against `STATUS_KINDS` before building any key (no `__proto__` path).
2. `STATUS_KINDS` already exists (`src/lib/statuses.ts:201`) — brief step 2 must reuse it,
   and derive message keys from `def.label`, not string concatenation.
3. Revalidation: use `revalidatePath("/app", "layout")`; note that the client provider in
   `(app)/layout.tsx` is not re-rendered on soft navigation (stale labels until reload — accept and note).
4. Overrides also rename table headers using `status.*` keys (customers table) — add to screenshot list.
5. Name all status-text call sites to check (kanban, filters, StatusSelect, notifications,
   aria-label/title); CSV stays raw keys (confirmed `orders-all-table.tsx:114-115`).
6. Stale overrides for removed keys are ignored — fine; optionally show in admin UI.
7. Option merge keeps target's emoji — mention in merge confirm dialog.

Confirmed fine: store never reads request-config messages or `options`; React escapes text so `<b>` cannot inject HTML.

## Missing tests
- Merge never mutates base messages (no cross-call leak); EN override does not leak into AR.
- Exact label round-trip through the render path (`createTranslator` or override map).
- request.ts / layout overlay falls back on no session, expired JWT, thrown fetch; store/tracking render ignores overrides.
- Agent PostgREST insert into `options` with emoji denied; control/bidi emoji rejected at DB; grapheme boundary + >16 chars rejected.
- DB rejects bad `kind`/`status_key` even from admin.
- `status_label_overrides` grants: anon none; authenticated no TRUNCATE/TRIGGER/REFERENCES; audit row on upsert and delete.
- Agent session: sees override in StatusPill and client-side StatusSelect; settings tab hidden and server action rejects.
- Pill with emoji + icon in full/compact/sm; RTL order of emoji before Latin label; both themes; keyboard pass through picker and labels section; en/ar key parity.
