@AGENTS.md

# Claude Code specifics

The shared conventions are in AGENTS.md (imported above) so that Antigravity
reads the same rules. This file only holds what is specific to Claude Code.

## Session protocol

Loop v3 in `.claude/loop.md`. Commands: `/bootstrap` (orient), `/analyse`,
`/verify`, `/execute`, `/ship`, `/decide` (answers a task's question or sends it
to the owner), and `/auto [n|id]` to run the whole loop; questions never stop
it (`docs/QUESTIONS.md`). Cheap models for routine work, opus for high-risk review.
Reviewers: `qa-reviewer` (risk high / security), `ui-reviewer` (surface ui).

Skills: `karpathy-guidelines` + `mnw-codebase-hygiene` before code,
`modern-web-guidance` (Google Chrome) before any HTML/CSS/client JS,
`cod-ui-polish` for app UI, `luxe-modesty-store-theme` for store UI,
`owasp-security` for security review. `impeccable`, `ui-ux-pro-max` and
`frontend-design` are vendored but manual-only (`/impeccable critique …`).
Tooling notes and sources: `docs/TOOLING.md`. Antigravity setup:
`docs/ANTIGRAVITY.md`. Codex setup: `docs/CODEX.md`.

## graphify

The code-map rule is in AGENTS.md ("Find code with the map first"). Without
graphify, use the Explore agent and targeted Grep — do not block on it.
