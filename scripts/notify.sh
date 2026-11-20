#!/usr/bin/env bash
# Send one short status line to the owner's phone. Does nothing unless a channel
# is configured in .env.local (never committed):
#   NOTIFY_NTFY_TOPIC=some-long-secret-name        → free ntfy app (ntfy.sh), no account
#   NOTIFY_TELEGRAM_TOKEN=…  NOTIFY_TELEGRAM_CHAT=…  → your own Telegram bot
# Only task ids and one-line results are sent — never customer data or secrets.
# Usage: scripts/notify.sh "STORE-4 shipped"
set -uo pipefail
cd "$(dirname "$0")/.."
msg=$(printf '%s' "${1:-}" | tr '\n' ' ' | cut -c1-300)
[ -n "$msg" ] || exit 0
topic=$(grep -E '^NOTIFY_NTFY_TOPIC=' .env.local 2>/dev/null | head -1 | cut -d= -f2-)
tg_token=$(grep -E '^NOTIFY_TELEGRAM_TOKEN=' .env.local 2>/dev/null | head -1 | cut -d= -f2-)
tg_chat=$(grep -E '^NOTIFY_TELEGRAM_CHAT=' .env.local 2>/dev/null | head -1 | cut -d= -f2-)
sent=0
if [ -n "$topic" ]; then
  curl -s -m 10 -o /dev/null -H "Title: MNW build" -d "$msg" "https://ntfy.sh/$topic" && sent=1
fi
if [ -n "$tg_token" ] && [ -n "$tg_chat" ]; then
  curl -s -m 10 -o /dev/null "https://api.telegram.org/bot${tg_token}/sendMessage" \
    --data-urlencode "chat_id=${tg_chat}" --data-urlencode "text=MNW build: ${msg}" && sent=1
fi
[ $sent = 1 ] && echo "notified" || echo "notify: no channel configured (see scripts/notify.sh)"
exit 0
