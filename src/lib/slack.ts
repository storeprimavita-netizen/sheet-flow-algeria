import { getSetting, SETTING_KEYS } from "@/lib/app-settings";

/**
 * Best-effort Slack notifier. Reads the bot token + channel from app_settings
 * (admin-set). Silently no-ops when Slack isn't configured; never throws —
 * a Slack outage must not break the order workflow.
 */
async function postSlack(text: string): Promise<void> {
  const [token, channel] = await Promise.all([
    getSetting(SETTING_KEYS.slackBotToken),
    getSetting(SETTING_KEYS.slackChannelId),
  ]);
  if (!token || !channel) return;

  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ channel, text }),
    });
    if (!res.ok) console.error("slack http error", res.status);
  } catch (err) {
    console.error("slack post failed", err);
  }
}

export async function notifyOrderEvent(opts: {
  orderNumber: string | null;
  stage: "confirmation" | "delivery";
  status: string;
  comment?: string | null;
}): Promise<void> {
  const icon = opts.stage === "confirmation" ? "✅" : "🚚";
  const ref = opts.orderNumber ?? "order";
  const msg = `${icon} *${ref}* — ${opts.stage}: ${opts.status}${
    opts.comment ? `\n> ${opts.comment}` : ""
  }`;
  await postSlack(msg);
}
