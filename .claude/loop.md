# MNW loop v2 — Analyse → Verify → Execute → Ship (token-lean, multi-model)

The main session is a cheap COORDINATOR. Heavy reading/writing happens in forked
subagents that return ≤ 150 words and leave detail in files (briefs, PROGRESS).
State lives in files, not in conversation: a task can resume in a fresh session.

| Step | Command | Model / effort | Context | Output |
|---|---|---|---|---|
| orient | `/bootstrap` | haiku / low | main | ≤150 words |
| 1 Analyse | `/analyse [id]` | sonnet / medium | fork | `docs/briefs/<id>.md` with `risk: high\|low` |
| 2 Verify | `/verify <brief\|diff>` | opus / high (`qa-reviewer`) | fork | ranked findings |
| 3 Execute | `/execute <id>` | sonnet / medium | fork | branch `mnw-<id>`, gate green |
| 4 Ship | `/ship <id>` | haiku / low | fork | merge into `mnw`, PROGRESS ≤ 8 lines |
| search | built-in `Explore` (overridden) | haiku / low | fork | answer + file:line |

## Which model for what (routing rule)
- **Haiku**: orientation, search/summarise, running the gate, bookkeeping (PROGRESS, plan ticks, merge). Never a decision.
- **Sonnet**: tracing code, writing briefs, implementing, routine fixes.
- **Opus**: design decisions with security/money/data consequences (planning a migration, permission matrix, KPI contract) and Verify of `risk: high` work. Verify caught every serious bug so far (NULL-logic RLS hole, direct-PATCH bypass) — do not downgrade it for high risk.
- `risk: low` (copy, UI polish, docs, tests): skip /verify; gate only. `risk: high` (RLS/auth/migration/money/webhook/ZR/public form): /verify is mandatory before ship, once on the brief if the design is non-obvious, always on the diff.

## Token rules
1. **Briefs, not transcripts.** Execute reads the brief + named files only. Analyse never reads `docs/PROGRESS_ARCHIVE.md`.
2. **Gate script.** `scripts/gate.sh` (tsc + tests + build + secret scan → ≤ 12 lines). Never paste build/test logs; read `/tmp/mnw-gate-*.log` tails only on failure.
3. **graphify first**, then targeted reads (hooks enforce this). No whole-file reads of big files; use offset/limit.
4. **Small returns.** Every delegation states a word cap and "write detail to a file".
5. **One task per session.** After Ship, `/clear` (free) — never grind a 100k-token context into the next task; `/compact` only mid-task.
6. **Cache hygiene.** Don't switch model/effort mid-task in the main session (invalidates cache); forks carry their own model. Subagents cache for 5 min by default — batch related reads in one subagent instead of many.
7. **Don't poll.** Background agents notify on completion; `/loop` only for external state (CI/deploy), self-paced ≥ 20 min.
8. **Skill hygiene.** Always-listed skill descriptions cost every turn: UI skills other than `cod-ui-polish` are `disable-model-invocation` (call `/impeccable` etc. by hand if wanted). Keep CLAUDE.md < 200 lines.
9. PROGRESS.md blocks ≤ 8 lines; history lives in `docs/PROGRESS_ARCHIVE.md`.

## Safety gates (unchanged)
Never print/commit secrets (redact). No push of unscrubbed history. No real parcels/messages. Stop for: destructive DB change, remote `db push`, push to GitHub before owner clears P0-6/P0-7 in PROGRESS.md, cost, missing credentials. No Delivery Agent (DECISIONS D9). Money/KPI/ZR definitions: DECISIONS D4/D12 + docs/ZR_EXPRESS_API_AUDIT.md.

## Resume
`/bootstrap` → `/analyse` → (`/verify` brief if high-risk & non-obvious) → `/execute <id>` → (`/verify diff` if high) → `/ship <id>` → `/clear`.
