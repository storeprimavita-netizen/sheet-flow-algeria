---
description: Cheap orientation for a fresh session (haiku) — current task, state, gates; no code
model: haiku
effort: low
---
Orient in <150 words, no code, no branch. Run `git fetch -q origin && git status -sb` first. Read only: AGENTS.md, PROGRESS.md (short — never docs/PROGRESS_ARCHIVE.md), and the task tables in docs/MASTER_PLAN.md. Report: (1) the next `todo` task whose deps are `done` (id + one line) and any task already `claimed:` (by whom); (2) its risk/surface if docs/briefs/<id>.md exists; (3) open owner inputs from the plan's "Owner inputs" table; (4) current branch and whether `v3` is behind `origin/v3`; (5) whether `node_modules` and local Supabase (`curl -s -m 2 http://127.0.0.1:54321/rest/v1/`) are available. Stop.
