---
description: Loop step 3 (sonnet, forked) — implement the brief on branch mnw-<id>, run the gate
model: sonnet
effort: medium
context: fork
---
Implement docs/briefs/<id>.md ($ARGUMENTS = id) and nothing else, on branch `mnw-<id>`. Invoke ponytail:ponytail first. Follow CLAUDE.md (no hardcoded colors/raw inputs, strings in en+ar, zod, RLS). Orient with `graphify query`; read only files the brief names. UI work: invoke cod-ui-polish; screenshot both themes.
Run `scripts/gate.sh` (never raw build/test commands — its output is the only log you read). Fix until GATE OK. If risk=high, STOP before merging and return "needs /verify". Do not merge, do not push.
Return ONLY: branch, files changed (names), gate result, deviations from the brief, open risks. Under 150 words.
