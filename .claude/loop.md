# Resume protocol
1. Read PROGRESS.md (bottom block) and docs/MASTER_PLAN.md; pick the first not-done task whose deps are met. Never redo done tasks.
2. Analyse → Verify (independent agent, give it the diff/plan not your conclusion) → Execute (branch `mnw-<id>`, ponytail first, graphify query to orient) → Ship (build, tsc, `LOCAL_SUPABASE_URL=http://127.0.0.1:54321 npm test`, redacted secret scan of the diff, merge --no-ff into mnw; push only after owner clears the P0-6/P0-7 gates).
3. Append evidence to PROGRESS.md and tick MASTER_PLAN. Stop on: destructive/irreversible DB change, real parcel/message, cost, owner credentials.
4. Never print secrets (redact before output). Never rewrite pushed history.
