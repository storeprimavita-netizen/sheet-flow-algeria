#!/usr/bin/env bash
# Open the Codex CLI in this project, using the Codex program inside the
# ChatGPT app when no separate `codex` is installed. Extra arguments are passed on.
# Usage: scripts/codex.sh            then type:  $loop-night
cd "$(dirname "$0")/.." || exit 1
app_cli="/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex"
if command -v codex >/dev/null 2>&1; then exec codex "$@"; fi
[ -x "$app_cli" ] || { echo "Codex not found — install the ChatGPT desktop app, see docs/CODEX.md"; exit 1; }
exec "$app_cli" "$@"
