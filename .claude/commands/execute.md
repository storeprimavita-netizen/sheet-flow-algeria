---
description: Loop stage 3 (sonnet, forked) — implement the brief on branch v3-<id>, push each step, run the gate
model: sonnet
effort: medium
context: fork
---
Implement docs/briefs/<id>.md ($ARGUMENTS = id) and nothing else, on branch `v3-<id>` cut from `v3` (create it if missing; if it exists, continue from its last commit). If a `docs/briefs/<id>.review-<n>.md` exists with `VERDICT: FIX`, fix exactly those findings.

Rules: AGENTS.md is binding (no hardcoded colors or raw inputs, strings in en+ar, zod at every boundary, RLS). Invoke `karpathy-guidelines` and `mnw-codebase-hygiene` before writing code; `ponytail:ponytail` too if that plugin is installed. Before using a Next.js API you are not sure of, read the guide in `node_modules/next/dist/docs/`. App UI: invoke `cod-ui-polish`. Storefront UI (anything under the public store routes): invoke `luxe-modesty-store-theme` instead — the two design systems never mix.

Work in the brief's step order. After each step: `scripts/gate.sh --fast`, then `scripts/step.sh "<id>: <what this step did>"`. When all steps are done run the full `scripts/gate.sh` (its output is the only log you read) and fix until GATE OK. Do not edit the gate, the reviewers, or delete tests to get there. Do not merge.

Return ONLY: branch, files changed (names), gate result, deviations from the brief, open risks, and "needs /verify" if the brief says risk high or names a surface. Under 150 words.
