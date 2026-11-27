risk: low · surface: ui · lane: shell

# NAV-1-H — command palette: "no match" line, readable filter regex, missing tests

Goal: close the leftovers of `docs/briefs/NAV-1-G.review-1.md`: ⌘K says when no page or action matches, the filter source has no invisible characters, and the four missing tests exist.

## Definition of done
- A non-empty query that matches no nav row and no action shows one muted line (EN + AR); the "Search" rows still show and Enter still runs the highlighted one.
- The line is absent for an empty query and as soon as any nav row or action matches (label, group or old name).
- `src/lib/palette-filter.ts` has no literal combining or invisible character: every such range is a `\u` escape with a comment.
- Persian ی folds to ي and ک to ك, on both query and rows.
- The four tests below exist and pass; en/ar key parity; gate OK.
- Palette seen live in AR light and EN dark (and the other two pairs for the new line).

## Files
- `src/lib/palette-filter.ts`
  - Strip regex (line ~6) holds literal characters; rewrite as `/[̀-ًͯ-ٰٟـ]/g` (same set, verified by code point).
  - The `[أإآ]` replace is dead: NFKD splits those into alef + U+0653–0655, which the strip removes. Delete it; the existing alef test must stay green. Comment that أ إ آ ؤ ئ fold this way.
  - Add `ی` (ی) → `ي` and `ک` (ک) → `ك`, written as escapes.
  - New pure helper `hasPaletteMatch(rows: { value: string; keywords?: string[] }[], search: string): boolean` = `rows.some(r => paletteFilter(r.value, search, r.keywords) === 1)`.
- `src/components/command-palette.tsx`
  - Build the nav and action rows once (`value`, `keywords`) and use the same objects for `CommandItem` and `hasPaletteMatch`, so the line cannot disagree with the list.
  - Between `CommandInput` and `CommandList`: an always-mounted `role="status"` container whose text appears only when `query.trim() && !hasPaletteMatch(...)`. Outside the listbox, no padding or height while empty, `text-muted-foreground`.
  - Keep the existing `CommandEmpty` as is. No change to `ui/command.tsx`; no `useCommandState`.
- `src/messages/en.json`, `ar.json`: `cmd.noNavMatch` = "No matching page or action." / "لا توجد صفحة أو إجراء مطابق."
- `src/lib/palette-filter.test.ts`: tests below.

## Steps (each: `scripts/gate.sh --fast`, then `scripts/step.sh`)
1. Filter: escapes, drop dead replace, Persian folding, `hasPaletteMatch`, tests.
2. Palette: shared rows, status line, `cmd.noNavMatch`, source test.
3. Full gate, screenshots, PROGRESS.md note.

## Acceptance tests (`palette-filter.test.ts`; no DOM env, D55)
- "Arabic old-name keyword matches": value from `ar.nav.groupSell` + `ar.nav.shipping`, keyword `ar.navOld.delivery`, query "التوصيل" → 1.
- "group-only query matches": `${ar.nav.groupSell} ${ar.nav.customers}` with `ar.nav.groupSell` → 1; same in EN.
- "nonsense EN query hides every real nav row": all `navLeaves("admin")` built from `en.json` (value and old-name keyword), "zzzz" → `hasPaletteMatch` false.
- "طلب against real AR labels": `ar.nav.all` and `ar.cmd.newOrder` → 1; `ar.nav.tasks` row → 0.
- "Persian yeh and keheh fold"; "filter source is ASCII inside its regexes" (read the file, no U+0300–036F, U+0640, U+064B–065F, U+0670 literal).
- Source test: `command-palette.tsx` uses `hasPaletteMatch` and `cmd.noNavMatch`.

## Screenshots (chrome-devtools, 1280 and 390 px, `docs/design/audit/NAV-1-H/`)
- Palette with "zzzz" (line + Search rows): EN dark, EN light, AR dark, AR light.
- Palette with a matching query and empty query in AR light and EN dark (NAV-1-G's unseen pair).
- One agent login: nonsense query shows the line once, no admin rows.

## Edge cases / notes
- Arabic comment text is fine in the source; only the regex and replacement characters must be escapes (replacement targets may be escapes too).
- `visibleNav(null)` has no rows: any query shows the line. Correct.
- ؤ/ئ folding, listed as optional in the review, already works through NFKD; only a test or comment is needed.
- Invisible characters pasted into the query (RLM, ZWJ) are not stripped: outside this task, append to `docs/BACKLOG.md`.
- This is a follow-up row: whatever stays open goes to the backlog, never a new row.
- Check `modern-web-guidance` for status-message announcement before writing the markup.
- No migration, no new dependency, no DECISIONS row needed. D32 (⌘K lists every Settings page) is unaffected.
