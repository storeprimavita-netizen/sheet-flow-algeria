import { getTranslations } from "next-intl/server";

import type { Tables } from "@/lib/supabase/database.types";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SecretField } from "@/components/fields/secret-field";
import { saveZRExpressConfig, syncZRTerritories, registerZRWebhook } from "./actions";

/**
 * ZR Express delivery-company push integration. Separate card from the
 * generic shopify/lightfunnels IntegrationsSection (order-source webhooks) —
 * different direction (we push to ZR, ZR calls us back for status) and
 * different credential shape (tenant ID + API key, not a store domain).
 */
export async function ZRExpressSection({
  config,
  territoryCount,
}: {
  config: Tables<"integration_configs"> | null;
  territoryCount: number;
}) {
  const t = await getTranslations();
  const cfg = (config?.config as { tenant_id?: string; api_key?: string } | null) ?? {};
  const webhookRegistered = !!config?.secret;

  return (
    <section id="zrexpress" className="card-surface scroll-mt-20 space-y-4 rounded-xl p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold">{t("settings.zrexpress.title")}</h2>
        <Badge variant={config?.last_event_at ? "default" : "outline"}>
          {config?.last_event_at ? t("settings.healthy") : t("settings.neverReceived")}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">{t("settings.zrexpress.description")}</p>

      <form action={saveZRExpressConfig} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("settings.zrexpress.tenantId")} htmlFor="zr-tenant-id">
          <Input id="zr-tenant-id" name="tenant_id" autoComplete="off" defaultValue={cfg.tenant_id ?? ""} />
        </Field>
        <Field
          label={t("settings.zrexpress.apiKey")}
          htmlFor="zr-api-key"
          hint={cfg.api_key ? t("settings.set") : t("settings.notSet")}
        >
          <SecretField
            id="zr-api-key"
            name="api_key"
            placeholder={t("settings.secretsHint")}
            showLabel={t("settings.showSecret")}
            hideLabel={t("settings.hideSecret")}
          />
        </Field>
        <div className="sm:col-span-2">
          <Button type="submit" size="sm">
            {t("actions.save")}
          </Button>
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <form action={syncZRTerritories}>
          <Button type="submit" variant="outline" size="sm">
            {t("settings.zrexpress.syncTerritories")}
          </Button>
        </form>
        <span className="text-xs text-muted-foreground">
          {territoryCount > 0
            ? `${t("settings.zrexpress.territoriesSynced")}: ${territoryCount}`
            : t("settings.zrexpress.territoriesNotSynced")}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <form action={registerZRWebhook}>
          <Button type="submit" variant="outline" size="sm">
            {t("settings.zrexpress.registerWebhook")}
          </Button>
        </form>
        <Badge variant={webhookRegistered ? "default" : "outline"}>
          {webhookRegistered ? t("settings.zrexpress.webhookRegistered") : t("settings.zrexpress.webhookNotRegistered")}
        </Badge>
      </div>
    </section>
  );
}
