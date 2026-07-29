import { getTranslations } from "next-intl/server";

import type { Tables } from "@/lib/supabase/database.types";
import { formatRelativeTime } from "@/lib/format";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/copy-button";
import { SecretField } from "@/components/fields/secret-field";
import { saveIntegration, sendTestWebhookEvent } from "./actions";

const PROVIDERS = ["shopify", "lightfunnels"] as const;

export async function IntegrationsSection({
  configs,
  baseUrl,
  locale,
}: {
  configs: Tables<"integration_configs">[];
  baseUrl: string;
  locale: string;
}) {
  const t = await getTranslations();
  const byProvider = new Map(configs.map((c) => [c.provider, c]));

  return (
    <section id="integrations" className="card-surface scroll-mt-20 space-y-6 rounded-xl p-5">
      <h2 className="text-sm font-semibold">{t("settings.integrations")}</h2>
      {PROVIDERS.map((provider) => {
        const cfg = byProvider.get(provider);
        const domain = (cfg?.config as { store_domain?: string } | null)?.store_domain ?? "";
        const url = `${baseUrl}/api/webhooks/${provider}`;

        return (
          <form
            key={provider}
            action={saveIntegration}
            className="space-y-3 border-t border-border pt-4 first:border-t-0 first:pt-0"
          >
            <input type="hidden" name="provider" value={provider} />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{t(`status.order_source.${provider}`)}</span>
              <Badge variant={cfg?.last_event_at ? "default" : "outline"}>
                {cfg?.last_event_at ? t("settings.healthy") : t("settings.neverReceived")}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {cfg?.last_event_at
                  ? t("settings.lastEventAt", { time: formatRelativeTime(cfg.last_event_at, locale) })
                  : null}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-md border border-input bg-muted/30 px-2 py-1 text-xs">
                {url}
              </code>
              <CopyButton text={url} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("settings.storeDomain")} htmlFor={`domain-${provider}`}>
                <Input id={`domain-${provider}`} name="store_domain" defaultValue={domain} />
              </Field>
              <Field
                label={t("settings.secret")}
                htmlFor={`secret-${provider}`}
                hint={cfg?.secret ? t("settings.set") : t("settings.notSet")}
              >
                <SecretField
                  id={`secret-${provider}`}
                  name="secret"
                  placeholder={t("settings.secretsHint")}
                  showLabel={t("settings.showSecret")}
                  hideLabel={t("settings.hideSecret")}
                />
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm">
                {t("actions.save")}
              </Button>
              <Button
                type="submit"
                formAction={sendTestWebhookEvent}
                variant="outline"
                size="sm"
                disabled={!cfg?.secret}
              >
                {t("settings.sendTestEvent")}
              </Button>
            </div>
          </form>
        );
      })}
    </section>
  );
}
