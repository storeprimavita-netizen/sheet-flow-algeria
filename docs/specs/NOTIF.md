# NOTIF — notifications (in-app + Telegram + ntfy)

Owner chose in-app + Telegram (D17). Slack was removed in phase 1 and stays out.

## In-app (NOTIF-1)

`notifications`: workspace_id, user_id (recipient), type, title, body, link
(an `/app/...` path), data jsonb, read_at, created_at. RLS: a user reads and
marks read only their own rows; inserts come from security-definer functions
and service-role jobs, never from the browser.

- Bell in the top bar with unread count; inbox sheet (unread first, mark all
  read); each item deep-links to the record. Unread count refreshes on
  navigation and on an interval — realtime is optional, not required.
- `notification_prefs` per user: per type, channel in-app / Telegram on or off.

## Events (who gets what)

| Event | Recipients | Agents may receive |
|---|---|---|
| Task assigned / reassigned / due today / overdue | assignee | yes |
| Task comment or status change | task owner + assignee | yes |
| Meeting scheduled / reminder (1 day, 1 hour) / objectives missing | attendees | yes |
| Order assigned to me / callback due | the agent | yes |
| New orders waiting > N minutes; stuck orders | admins (+ agents on duty, count only) | yes, no money |
| Low stock, wilaya stop-shipping flag, carrier sync failing | admins | no |
| Low account balance, courier payout recorded | admins | no |
| Daily summary (orders, confirmation %, delivered) | admins | optional, rates only |

Rule: a notification never carries anything its recipient could not open in
the app. Agent-facing texts contain no cost, profit, ad spend or balances —
enforced where the notification is built (typed builders per event), tested.

## Telegram (NOTIF-2, risk high: webhook + tokens)

- One bot per workspace; bot token in `integration_configs` (admin-only).
- **Linking a member**: Settings → Notifications shows "Connect Telegram" →
  a one-time code (10 min) → `https://t.me/<bot>?start=<code>` → the bot's
  webhook receives `/start <code>` and stores `telegram_chat_id` for that user
  in `notification_channels` (user_id, channel, address, verified_at). Unlink
  from the same screen. No member is added by typing a chat id.
- Webhook `POST /api/webhooks/telegram/<workspace>`: verified by Telegram's
  secret-token header (constant-time compare), zod-validated, handles only
  `/start` and `/stop`; any other text gets a short help reply. Message text
  from Telegram is data, never a command to the system.
- **Outbox**: `notification_deliveries` (notification_id, channel, status,
  attempts, last_error). A cron worker sends with retry; Telegram being down
  never blocks the action that caused the notification. Respect Telegram rate
  limits (batch, backoff on 429).
- Messages: one or two lines + a link to the app. No customer phone numbers or
  addresses in Telegram messages.
- Optional group chat for the team (admin links a group the same way) for
  meeting reminders and the daily summary.

## ntfy (NOTIF-4, D100)

For phone alerts without an app of our own: the free ntfy app (Android, iPhone)
or its web page subscribes to a topic; the server publishes with one HTTPS POST.

- Settings → Notifications → ntfy (admin): server address (default
  `https://ntfy.sh`, a self-hosted server works the same), topic, optional
  access token, "Send test", and a QR code / link that opens the subscription.
  Stored in `integration_configs` (admin-only); the token never reaches the
  browser after saving.
- The app generates the topic (32+ random characters) and can replace it in one
  tap: on the free ntfy.sh service anyone who knows the topic can read it, so
  the topic is a secret and is replaced when a team member leaves.
- A topic is shared by its subscribers, so ntfy carries only workspace-level
  alerts: new order, and the admin alerts of NOTIF-3. Personal notifications
  (task assigned to me, my callback) stay on the bell and Telegram.
- New-order alert: title "New order", text `#number · product · wilaya · total`,
  click link to the order in the app (login required). Never the customer's
  name, phone or address, never cost or profit. Sent right after the order is
  saved, outside the request that saved it; the outbox only retries.
- Limits to state in the UI: free ntfy.sh allows 250 messages a day and gives no
  delivery guarantee; iPhone delivery is less reliable than Android. Above that
  volume: a paid ntfy plan or a self-hosted server — the owner's choice.
- Later, not in this row: push from the app's own installed web page (Web Push).

## Rules

- Dev/preview never send real Telegram messages (no-op sender unless
  production and the bot is configured; tests use fixtures).
- Templates live in `src/messages/{en,ar}.json`; each user gets their locale.
- Vercel Hobby allows daily cron only: reminders that need minutes (callback
  due, meeting in 1 hour) are computed when the user loads the app, and sent
  to Telegram by the worker on its next run — state the delay honestly in the
  UI, or the owner moves to a plan with frequent cron (owner input N-1).

## Tasks

NOTIF-1 table + bell + inbox + prefs + task/meeting/order events (lane db) ·
NOTIF-2 Telegram linking + webhook + outbox worker · NOTIF-3 admin alerts
(stock, balance, stuck orders, daily summary) · NOTIF-4 ntfy channel.

## Acceptance

User A cannot read user B's notifications (RLS test) · agent-targeted builders
have no money fields (type-level + test) · wrong secret header → 401 and no
row · expired or reused link code is rejected · failed send retries, then
marks failed without throwing · an ntfy message never contains a customer name,
phone or address (builder test) · the ntfy token is not returned to the browser.
