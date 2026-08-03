---
description: Phase-14 loop step 2 (glm-5.2) — pick next planned phase, trace it, append a GLM 5.2 execution brief, stop
---

Read CLAUDE.md and PROGRESS.md. In the phase table, find the FIRST 14-series row
whose Status is "planned" AND whose phase file section does NOT yet contain a
"### GLM 5.2 execution brief" subsection (top-down = dependency order) — that
is your phase. If the only planned rows left are 14h (Google) or any row marked
"needs user setup"/blocked, STOP and tell the user what setup is required.

Read that phase's section in docs/phases/phase-14-plan.md §<id> (for 14h read
the whole docs/phases/phase-14h-google-oauth.md) + the "Locked decisions" block.
Use `graphify query` to orient, then trace every file/table/RLS policy/view the
section actually touches — read the real current code, don't trust the plan
blindly (it may have drifted since it was written). Do NOT write feature code,
create a branch, or touch the phase table's Status.

Produce a concrete execution brief and append it as a new subsection directly
under that phase's `## 14x` heading in the SAME phase file:

### GLM 5.2 execution brief
- Exact files to touch (paths, not descriptions) and what changes in each.
- Exact migration SQL skeleton if the phase needs one.
- Order of steps (what must land before what).
- Every place the "Locked decisions" assumptions were confirmed or turned out
  stale, with the corrected fact.
- Edge cases / gotchas found while tracing (RLS interactions, trigger
  ordering, existing views that already compute part of this — reuse, don't
  rebuild).

Stop after appending. Do not run npm/build, do not commit.
