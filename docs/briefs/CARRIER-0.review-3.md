VERDICT: ESCALATE

## Summary
Round 3 with no PASS, so this escalates under the loop rule. The code itself is correct: the review-1 and review-2 findings are fixed, centroids 49–58 have the moved coordinates and the seed names, and pickWilaya is guarded with 8 tests. One medium remains, in the UI evidence. The 390px AR light screenshot still shows the RTL legend bidi bug that commit dd715de says it fixes. Owner: accept a retake plus PASS, or send it back for round 4.

## Findings (ranked)

1. **MEDIUM** · `docs/design/audit/CARRIER-0/map-light-ar-390.png` (fix at `src/components/dashboard/wilaya-section.tsx:100-105`)
   Failure: the legend reads `40%>`, `85%–70`, `55%–40` and `+85%`. The desktop AR captures read correctly. I opened the file and confirmed it. The fix and the screenshots landed in the same commit (dd715de), so this shot was either taken before the `<bdi dir="ltr">` fix or the fix does not apply at 390px. The shot also crops mid-scroll, so the map and legend are never framed together.
   Fix: rerun at 390px in AR dark and light. Confirm the legend reads `<40%`, `40–55%`, `70–85%` and `85%+`. If it is still reversed, wrap every legend label (not only some) in `<bdi dir="ltr">`. Frame the shot on the map card.

2. **LOW** · `src/components/dashboard/algeria-map.tsx:~108` (titleText): the tooltip hardcodes the English "no data". Use the `dashboard.wilaya.noData` key.

3. **LOW** · `algeria-map.tsx` path elements: cells have onClick but no tabIndex, role or aria-label, so keyboard users cannot reach them. Add `tabIndex=0`, `role="button"`, an aria-label of name plus rate, and Enter/Space handling. This predates the task.

4. **LOW** · `src/lib/webhook.ts:119-135` pickWilaya: on a full address the longest whole-word match can pick the wrong wilaya. "Rue Tipaza, Alger" gives 42, not 16. Note in the comment that the input is the wilaya field only.

5. **LOW** · `wilaya-section.tsx`: the table label "Timimoun-49" reads awkwardly in RTL. Put the code in its own `<bdi dir="ltr">`.

6. **LOW** · `webhook.ts` matchWilayaCode: `data ?? []` swallows a wilayas query error, so the wilaya silently becomes null. Log the error. This predates the task.

## Missing tests
- Centroids 49–58 have distinct lat/lon pairs.
- `pickWilaya("Oued")` gives 39 (the single partial-hit path).
- `"Ksar El Boukhari, Médéa"` gives 26 (the brief's own example), plus one address-style input.
- A component test that every legend label is wrapped in `bdi dir="ltr"`.

## Not verified
The reviewer did not drive the browser, hover tooltips or rerun vitest and the gate. The verdict rests on the diff, the tests and the committed screenshots.
