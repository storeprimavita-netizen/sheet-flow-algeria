---
model: claude-fable-5-2
description: Loop decision step (forked, runs on the session's model — Fable) — answer a question a task raised, or route it to the owner without stopping other work
effort: high
context: fork
---
$ARGUMENTS = a task id followed by the question, or the path of the review/brief that raised it.

Read what the question depends on: `docs/briefs/<id>.md` and its review files, the spec the task names, `docs/DECISIONS.md`, `docs/QUESTIONS.md` (the owner may already have answered something close), and the code or data file the question is about. Look at the owner's own files before asking for them (for example `prices/` holds the delivery-price sheet).

Then choose exactly one:

**DECIDE** — when the answer follows from an existing decision, a spec, something the owner already said, or the owner's own data; or it is a technical or design choice with a clearly safer option. It must be cheap to change later (no lost data, no wrong amount charged to a customer, no wider access for a role).
→ Append a row to `docs/DECISIONS.md`: next D-number, the decision, and in the second column `Decided by Claude <date> for <task id> — owner may overturn.` plus the reason and the alternative rejected. If a default was needed for something only the owner knows for sure, apply the safest default, and ALSO log it in `docs/QUESTIONS.md` as `answered-by-default` so the owner sees it.

**A price rule or a report formula with a clear recommended option (D104)** — when nothing irreversible follows (no customer has already been charged under the other rule, nothing is deleted, no role sees more): DECIDE with the recommended option, and log it in `docs/QUESTIONS.md` under "Answered" as answered-by-default so the owner sees it.

**ASK** — when it needs a fact only the owner has (credential, account, official list, a price), or it changes amounts customers were already charged, what a role may see or do, deletes or rewrites data, costs money, or contradicts a locked decision.
→ Append to `docs/QUESTIONS.md` under "Open": `### Q-<n> · <task id> · <date>`, the question in plain words (no code names), 2–3 options with the recommended one first and why, and what stays blocked until it is answered.

Commit with `scripts/step.sh "<id>: decision D<n>"` or `"<id>: question Q-<n>"`.

Return one line only: `DECIDED: D<n> <decision in ≤ 20 words>` or `ASK: Q-<n> <question in ≤ 150 characters, ending with the recommended answer>`.
