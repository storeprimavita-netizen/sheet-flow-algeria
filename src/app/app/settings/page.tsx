import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/rbac";
import { readSettings, SETTING_KEYS } from "@/lib/app-settings";
import { PageHeader } from "@/components/page-header";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/copy-button";

async function saveSettings(formData: FormData) {
  "use server";
  const pairs: Array<[string, string]> = [
    [SETTING_KEYS.lightfunnelSecret, String(formData.get("lightfunnel_secret") ?? "").trim()],
    [SETTING_KEYS.shopifySecret, String(formData.get("shopify_secret") ?? "").trim()],
    [SETTING_KEYS.slackBotToken, String(formData.get("slack_bot_token") ?? "").trim()],
    [SETTING_KEYS.slackChannelId, String(formData.get("slack_channel_id") ?? "").trim()],
  ];
  const supabase = await createClient();
  for (const [key, value] of pairs) {
    if (!value) continue;
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key, value }, { onConflict: "key" });
    if (error) console.error("settings save error", key, error.message);
  }
  revalidatePath("/app/settings");
}

function WebhookRow({
  label,
  url,
  ok,
  setText,
  notSetText,
}: {
  label: string;
  url: string;
  ok: boolean;
  setText: string;
  notSetText: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{label}</span>
        <Badge variant={ok ? "default" : "outline"}>{ok ? setText : notSetText}</Badge>
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-md border border-border bg-muted/30 px-2 py-1 text-xs">
          {url}
        </code>
        <CopyButton text={url} />
      </div>
    </div>
  );
}

export default async function SettingsPage() {
  await requireAdmin();
  const t = await getTranslations();

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = (process.env.APP_URL ?? `${proto}://${host}`).replace(/\/$/, "");
  const urls = {
    lightfunnel: `${base}/api/webhooks/lightfunnel`,
    shopify: `${base}/api/webhooks/shopify`,
  };

  const supabase = await createClient();
  const values = await readSettings(supabase, Object.values(SETTING_KEYS));
  const isSet = (k: string) => Boolean(values[k]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />

      <div className="glass-card space-y-4 rounded-xl p-5">
        <div>
          <h2 className="text-sm font-semibold">{t("settings.webhooks")}</h2>
          <p className="text-xs text-muted-foreground">{t("settings.webhooksHint")}</p>
        </div>
        <WebhookRow
          label={t("settings.lightfunnelSecret")}
          url={urls.lightfunnel}
          ok={isSet(SETTING_KEYS.lightfunnelSecret)}
          setText={t("settings.set")}
          notSetText={t("settings.notSet")}
        />
        <WebhookRow
          label={t("settings.shopifySecret")}
          url={urls.shopify}
          ok={isSet(SETTING_KEYS.shopifySecret)}
          setText={t("settings.set")}
          notSetText={t("settings.notSet")}
        />
      </div>

      <form action={saveSettings} className="glass-card space-y-4 rounded-xl p-5">
        <div>
          <h2 className="text-sm font-semibold">{t("settings.secrets")}</h2>
          <p className="text-xs text-muted-foreground">{t("settings.secretsHint")}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("settings.lightfunnelSecret")} htmlFor="lightfunnel_secret">
            <Input
              id="lightfunnel_secret"
              name="lightfunnel_secret"
              type="password"
              autoComplete="off"
            />
          </Field>
          <Field label={t("settings.shopifySecret")} htmlFor="shopify_secret">
            <Input id="shopify_secret" name="shopify_secret" type="password" autoComplete="off" />
          </Field>
          <Field label={t("settings.slackToken")} htmlFor="slack_bot_token">
            <Input id="slack_bot_token" name="slack_bot_token" type="password" autoComplete="off" />
          </Field>
          <Field label={t("settings.slackChannel")} htmlFor="slack_channel_id">
            <Input id="slack_channel_id" name="slack_channel_id" autoComplete="off" />
          </Field>
        </div>
        <Button type="submit">{t("actions.save")}</Button>
      </form>
    </div>
  );
}
