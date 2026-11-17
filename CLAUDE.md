@AGENTS.md

# Claude Code specifics

The shared conventions are in AGENTS.md (imported above) so that Antigravity
reads the same rules. This file only holds what is specific to Claude Code.

## Session protocol

Loop v3 in `.claude/loop.md`. Commands: `/bootstrap` (orient), `/analyse`,
`/verify`, `/execute`, `/ship`, and `/auto [n|id]` to run the whole loop until a
stop condition. Cheap models for routine work, opus for high-risk review.
Reviewers: `qa-reviewer` (risk high / security), `ui-reviewer` (surface ui).

Skills: `karpathy-guidelines` + `mnw-codebase-hygiene` before code,
`cod-ui-polish` for app UI, `luxe-modesty-store-theme` for store UI,
`owasp-security` for security review. `impeccable`, `ui-ux-pro-max` and
`frontend-design` are vendored but manual-only (`/impeccable critique …`).
Tooling notes and sources: `docs/TOOLING.md`. Antigravity setup:
`docs/ANTIGRAVITY.md`.

## graphify (optional)

If `graphify` is installed and `graphify-out/graph.json` exists: run
`graphify query "<question>"` before broad searches, `graphify path "<A>" "<B>"`
for relationships, and `graphify update .` after modifying code. If it is not
installed, use the Explore agent and targeted Grep instead — do not block on it.
