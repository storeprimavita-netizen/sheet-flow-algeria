VERDICT: FIX

## Summary
Diff review of `git diff v3...v3-NAV-4` by qa-reviewer (risk high) and ui-reviewer (surface ui).
DB side is sound: policies, grants, CHECKs, triggers, React `cache()` loader, hasOwn lookups and admin re-checks all hold, and the 5 NAV-4 test files pass (21 tests).
Blocker: `StatusPill` calls a client hook from server components, so admin product and stock pages return an error page.
Also: the Done-when screenshot set is mostly missing, and emoji validation rejects flags and keycaps (the Algerian flag cannot be set).

## Findings (ranked)

### HIGH
1. **StatusPill crashes every server component that renders it** — `src/components/status-pill.tsx:4,26`
   - The file has no `"use client"`, but it calls `useStatusLabel()` from the `"use client"` module `src/components/status-labels-provider.tsx`. In a server component that import is only a client reference, so the call throws.
   - Confirmed as admin: `/app/catalog/stock` and `/app/catalog/products/<id>` (and its `/stock`) render "Attempted to call useStatusLabel() from the server but useStatusLabel is on the client".
   - The same crash is waiting in other server consumers once they have rows: `catalog/products/[id]/layout.tsx`, `products/[id]/page.tsx`, `products/[id]/stock/page.tsx`, `store/page.tsx`, `store/pages/page.tsx`, `store/reviews/page.tsx`, `product-form.tsx`.
   - Vitest ignores `"use client"`, so the tests miss it.
   - Fix: add `"use client"` to `status-pill.tsx` (its props are serialisable). Alternatively, add a server variant that reads `getStatusLabelOverrides()` + `getLocale()`.
   - Then load every StatusPill consumer page and check it renders.

### MEDIUM
2. **Done-when not met: screenshots** — `docs/design/audit/NAV-4*`, PROGRESS.md
   - Only settings (AR dark 1280) and the picker (AR light 390) were captured.
   - Missing: EN; the other theme; 390 for options, order detail, kanban and customers; the orders list; the order detail workflow; the delivery kanban; customers table headers; an agent session seeing an override; /login unaffected.
   - Edge cases not shown: an emoji-only override; a 40-char label in compact pills; a label starting with an emoji hiding the Lucide icon.
   - A product-detail screenshot would have caught finding 1.
   - Fix: capture the full list in the brief (dark+light, EN+AR, 1280+390), including an agent session with a saved override.
3. **Emoji validation rejects flags and keycaps** — `src/lib/emoji.ts:6` (`PICTOGRAPHIC = /\p{Extended_Pictographic}/u`)
   - 🇩🇿, #️⃣ and 1️⃣ fail `emojiSchema`, so admins cannot pick the Algerian flag.
   - `startsWithEmoji` has the same gap, so the Lucide icon is not hidden for a label that starts with a flag.
   - Fix: also accept `\p{Regional_Indicator}{2}` and keycap sequences, or use `/^\p{RGI_Emoji}$/v`. Check that the DB CHECK accepts them too.

### LOW
4. **Emoji-only status override has no accessible status name** — `src/components/status-pill.tsx` passes the override as children without `emojiLabel`. A screen reader announces only the emoji name, but the brief requires the default label as sr-only text. Fix: when the resolved label is emoji-only, pass the default label as the sr-only text.
5. **Some invisible characters still pass label validation** — `00073` label CHECK and `emoji.ts:5` `FORBIDDEN` allow U+061C (Arabic letter mark), U+2028/2029 and U+FEFF. Also, `labelSchema` strips U+200D (ZWJ), so "👩‍💻 Dev" is saved as two separate emoji. Fix: forbid those characters in both places and keep ZWJ in labels, as the emoji column does.
6. **Saving one language overwrites the other** — `settings/actions.ts` (saveStatusLabel). The upsert writes both `label_en` and `label_ar`, so when two admins edit different languages of the same row, the last save wins. Fix: write only the language column that changed, or accept and document this.
7. **Emoji picker grid ARIA and keyboard** — `src/components/fields/emoji-field.tsx`. `role="grid"` has no `role="row"` children, each cell's `aria-label` is the raw glyph, and all 36 cells are in the Tab order. Fix: use roving tabindex, add row wrappers (or use `role="group"`), and give each cell a name.
8. **Placeholder looks like typed text** — `status-labels-section.tsx:78-87`. The placeholder (the default label) uses the same colour as entered text, so an empty field looks overridden. The disabled reset button is also hard to tell apart. Fix: use the muted-foreground token for the placeholder and a clearer disabled state.
9. **Store status select ignores overrides** — `store/_components/settings-form.tsx:72` uses `ts("draft")`… instead of the resolver. Fix: route it through `useStatusLabel`/`resolveStatusLabel`.
10. **Extra sequential query on every /app page** — `src/app/(app)/app/layout.tsx:21` awaits `getStatusLabelOverrides()` before the existing `Promise.all`. Fix: move it into the `Promise.all`.
11. **Preview shows one locale; stale labels after save** — the live preview shows only the page locale. After a save, soft navigation keeps showing the old labels until reload (the brief accepts this, but the "saved" toast reads as if the change is live everywhere). Optional: preview both EN and AR, or say "reload to see everywhere".

## Missing tests
- A smoke test (dev-server fetch or an RSC render) of a server page that uses StatusPill, such as product detail or stock. This would have caught #1.
- `emojiSchema` and the DB CHECK accept 🇩🇿, #️⃣, 1️⃣ and a ZWJ sequence.
- An emoji-only override in StatusPill keeps the default label as sr-only text.
- `saveStatusLabel`, `resetStatusLabel` and `setOptionEmoji` reject an agent session at the action layer, not just RLS.
- An agent session sees the override in StatusSelect (client) and on a server-rendered page.
- The label CHECK rejects U+061C, U+2028, U+2029 and U+FEFF.
