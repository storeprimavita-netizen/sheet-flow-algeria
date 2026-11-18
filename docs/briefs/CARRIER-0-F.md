# CARRIER-0-F — Arabic map legend at 390 px: verify, fix if needed, retake
risk: low · surface: ui · lane: orders

Goal: the dashboard wilaya map legend reads correctly in Arabic (RTL) at 390 px, proven by a fresh screenshot framed on the map card.

## Definition of done
- Legend labels read `<40%`, `40–55%`, `55–70%`, `70–85%`, `85%+` (not `40%>`, `85%–70`) in AR light and AR dark at 390 px.
- `docs/design/audit/CARRIER-0/map-light-ar-390.png` replaced; add `map-dark-ar-390.png`; both frame map + legend together.
- Map tooltip "no data" uses `dashboard.wilaya.noData` (en/ar parity kept).
- Table label "Timimoun-49" code in its own `<bdi dir="ltr">`.
- gate.sh green. No migration, no DECISIONS row.

## Findings from reading the code
- `src/app/app/dashboard/wilaya-section.tsx:100-104` ALREADY wraps all five range labels in `<bdi dir="ltr">` (fix landed in dd715de). The committed 390 px PNG is most likely stale (taken before the fix). So step 1 is to look, not to edit.
- Possible real cause if still reversed: the `<bdi>` is inside a flex row, fine; but check for `&lt;` rendering and the en dash. If reversed, add `unicode-bidi: isolate` via `<bdi dir="ltr" className="[unicode-bidi:isolate]">` or put the whole label in `<span dir="ltr">`.
- `src/components/dashboard/algeria-map.tsx:~120` hardcodes `" — no data"` in `titleText`.

## Files
- `src/app/app/dashboard/wilaya-section.tsx`: only if step 1 shows still reversed; also wrap the wilaya code in the table label in `<bdi dir="ltr">`.
- `src/components/dashboard/algeria-map.tsx`: replace the literal with the `dashboard.wilaya.noData` string (pass via prop or `useTranslations`, whichever the component already uses).
- `docs/design/audit/CARRIER-0/*-390.png`: new screenshots.
- Optional (review-3 lows 3, 4, 6, left out unless trivial): map cell keyboard access, pickWilaya comment, matchWilayaCode error log. Not required.

## Steps (each committed with scripts/step.sh)
1. Run app, set locale AR, viewport 390x844, scroll to the map card, screenshot light and dark. If legend correct, go to step 3.
2. If reversed: apply the bidi fix above, re-shoot.
3. tooltip noData i18n + Timimoun code bdi.
4. Save screenshots, note in PROGRESS.md; run gate.

## Acceptance
- Existing `algeria-map.test.ts` still passes; add a test (or extend) asserting the legend labels in wilaya-section are wrapped in `bdi[dir=ltr]` if a component test setup exists, else state so.
- Screens: dashboard map card, AR+EN, light+dark, 390 px and desktop.

## Assumptions
- Stale screenshot rather than a code bug (to confirm in step 1).
- No browser MCP available means say so explicitly in PROGRESS.md; chrome-devtools MCP is available in this repo.
