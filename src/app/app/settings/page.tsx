import { headers } from "next/headers";
import { getTranslations, getLocale } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/rbac";
import { getSetting } from "@/lib/settings";
import { getAllOptionSets, getOptionUsageCounts, type OptionSetKey } from "@/lib/option-sets";
import { PageHeader } from "@/components/page-header";

import { WorkspaceSection } from "./workspace-section";
import { IntegrationsSection } from "./integrations-section";
import { ZRExpressSection } from "./zrexpress-section";
import { WebhookEventsSection } from "./webhook-events-section";
import { FeesSection } from "./fees-section";
import { FixedFeesSection } from "./fixed-fees-section";
import { ExchangeRatesSection } from "./exchange-rates-section";
import { EngineRulesSection } from "./engine-rules-section";
import { MeetingScheduleSection } from "./meeting-schedule-section";
import { OptionsSection } from "./options-section";
import { AppearanceSection } from "./appearance-section";

const NAV_SECTIONS = [
  ["workspace", "settings.workspace"],
  ["integrations", "settings.integrations"],
  ["delivery-fees", "settings.deliveryFees"],
  ["fixed-fees", "settings.fixedFees"],
  ["exchange-rates", "settings.exchangeRates"],
  ["engine-rules", "settings.engineRules"],
  ["meeting-schedule", "settings.meetingSchedule"],
  ["options", "settings.options.title"],
  ["appearance", "settings.appearance"],
] as const;

export default async function SettingsPage() {
  const t = await getTranslations();
  const locale = await getLocale();
  const profile = (await getProfile())!;
  const supabase = await createClient();

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = (process.env.APP_URL ?? `${proto}://${host}`).replace(/\/$/, "");

  const [
    workspaceRes,
    integrationsRes,
    zrTerritoryCountRes,
    webhookEventsRes,
    wilayaFeesRes,
    wilayaStatsRes,
    fixedFeesRes,
    exchangeRatesRes,
    usdRateRes,
    eurRateRes,
    returnFee,
    duplicateWindow,
    riskWeights,
    stopShippingRule,
    meetingSchedule,
  ] = await Promise.all([
    supabase.from("workspaces").select("*").eq("id", profile.workspaceId).single(),
    supabase.from("integration_configs").select("*").eq("workspace_id", profile.workspaceId),
    supabase
      .from("zr_territories")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", profile.workspaceId),
    supabase
      .from("webhook_events")
      .select("*")
      .eq("workspace_id", profile.workspaceId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("wilaya_fees")
      .select("wilaya_code, home_fee, stopdesk_fee, stop_shipping, wilaya:wilayas(name)")
      .eq("workspace_id", profile.workspaceId)
      .order("wilaya_code"),
    // Ph.7 stop-shipping auto flag (dashboard computes the same thing, filtered)
    supabase.from("wilaya_stats").select("wilaya_code, stop_shipping_auto").eq("workspace_id", profile.workspaceId),
    supabase.from("fixed_fees").select("*").eq("workspace_id", profile.workspaceId).order("created_at"),
    supabase
      .from("exchange_rates")
      .select("*")
      .eq("workspace_id", profile.workspaceId)
      .order("valid_from", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.rpc("current_fx_rate", { p_ws: profile.workspaceId, p_currency: "USD" }),
    supabase.rpc("current_fx_rate", { p_ws: profile.workspaceId, p_currency: "EUR" }),
    getSetting(profile.workspaceId, "return_fee"),
    getSetting(profile.workspaceId, "duplicate_window"),
    getSetting(profile.workspaceId, "risk_weights"),
    getSetting(profile.workspaceId, "stop_shipping_rule"),
    getSetting(profile.workspaceId, "meeting_schedule"),
  ]);

  const rates = { USD: usdRateRes.data ?? 1, EUR: eurRateRes.data ?? 1 };

  const optionSets = await getAllOptionSets(profile.workspaceId);
  const optionUsage = Object.fromEntries(
    await Promise.all(optionSets.map(async (s) => [s.key, await getOptionUsageCounts(profile.workspaceId, s.key)])),
  ) as Record<OptionSetKey, Record<string, number>>;

  return (
    <div className="space-y-6">
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[12rem_1fr]">
        <nav className="hidden lg:sticky lg:top-20 lg:block lg:h-fit lg:space-y-0.5 lg:text-sm">
          {NAV_SECTIONS.map(([id, key]) => (
            <a
              key={id}
              href={`#${id}`}
              className="block rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground"
            >
              {t(key)}
            </a>
          ))}
        </nav>

        <div className="min-w-0 space-y-6">
          <WorkspaceSection name={workspaceRes.data?.name ?? ""} />

          <div className="space-y-6">
            <IntegrationsSection configs={integrationsRes.data ?? []} baseUrl={baseUrl} locale={locale} />
            <ZRExpressSection
              config={(integrationsRes.data ?? []).find((c) => c.provider === "zrexpress") ?? null}
              territoryCount={zrTerritoryCountRes.count ?? 0}
            />
            <WebhookEventsSection events={webhookEventsRes.data ?? []} />
          </div>

          <FeesSection
            rows={wilayaFeesRes.data ?? []}
            autoFlagged={
              new Set(
                (wilayaStatsRes.data ?? [])
                  .filter((s) => s.stop_shipping_auto && s.wilaya_code !== null)
                  .map((s) => s.wilaya_code as number),
              )
            }
          />
          <FixedFeesSection fees={fixedFeesRes.data ?? []} rates={rates} />
          <ExchangeRatesSection
            rates={exchangeRatesRes.data ?? []}
            current={{ USD: usdRateRes.data ?? null, EUR: eurRateRes.data ?? null }}
          />
          <EngineRulesSection
            returnFee={returnFee}
            duplicateWindow={duplicateWindow}
            riskWeights={riskWeights}
            stopShippingRule={stopShippingRule}
          />
          <MeetingScheduleSection meetingSchedule={meetingSchedule} />
          <OptionsSection sets={optionSets} usage={optionUsage} />
          <AppearanceSection />
        </div>
      </div>
    </div>
  );
}
