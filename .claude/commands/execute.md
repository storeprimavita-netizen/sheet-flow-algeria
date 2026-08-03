---
description: Phase-14 loop step 3 (glm-5-turbo) — build/test/review/screenshot the phase whose brief exists, then merge
---

Read CLAUDE.md and PROGRESS.md. In the phase table, find the FIRST 14-series row
whose Status is "planned" AND whose phase file section already contains a
"### GLM 5.2 execution brief" subsection. If the first planned row has NO
brief yet, STOP and tell the user to switch back with `/model glm-5.2` and run
the ANALYZE prompt for that phase first — do not analyze it yourself and do not
skip ahead to a later row that happens to have a brief.

Read that phase's section + its execution brief + the "Locked decisions" block
in docs/phases/phase-14-plan.md §<id> (for 14h: docs/phases/phase-14h-google-oauth.md).
Execute THAT phase only, following the brief, on branch mnw-<id> (row "14c …" →
§14c → branch mnw-14c). Read nothing else unless pointed there.

Invoke ponytail:ponytail before writing code. Use `graphify query` to orient,
not broad greps. No raw <input>/native <select> (use components/fields/* +
Radix); no hardcoded colors; every user-visible string in
src/messages/{en,ar}.json (EN + AR).

When `npm run build` (and `npm test`) is green: run ponytail:ponytail-review on
the diff, `graphify update .`, screenshot every screen you touched in BOTH
themes with the Playwright MCP and fix what they show. Then (a) append a
PROGRESS.md handoff block and (b) flip this phase's row Status from "planned" to
"done" in the phase table. Merge --no-ff into mnw. Stop after this one phase.
