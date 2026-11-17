#!/usr/bin/env bash
# The shared skills in .agents/skills/ are symlinks into .claude/skills/ so both
# agents read one copy. If Antigravity does not follow symlinks on your setup,
# run this with --copy to replace them with real copies (re-run after editing a
# skill). --link restores the symlinks.
# Usage: scripts/sync-agent-skills.sh --copy | --link
set -euo pipefail
cd "$(dirname "$0")/.."
shared="cod-ui-polish luxe-modesty-store-theme mnw-codebase-hygiene owasp-security karpathy-guidelines"
mode=${1:-}
case "$mode" in --copy|--link) ;; *) echo "usage: $0 --copy | --link"; exit 1 ;; esac
for s in $shared; do
  [ -d ".claude/skills/$s" ] || { echo "missing .claude/skills/$s"; exit 1; }
  rm -rf ".agents/skills/$s"
  if [ "$mode" = "--copy" ]; then cp -R ".claude/skills/$s" ".agents/skills/$s"; else ln -s "../../.claude/skills/$s" ".agents/skills/$s"; fi
  echo "$mode  $s"
done
