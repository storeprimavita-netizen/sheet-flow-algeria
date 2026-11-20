import Link from "next/link";
import { headers } from "next/headers";
import { getTranslations, getLocale } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/rbac";
import { getSetting } from "@/lib/settings";
import { getAllOptionSets, getOptionUsageCounts, type OptionSetKey } from "@/lib/option-sets";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";

import { WorkspaceSection } from "./workspace-section";
import { IntegrationsSection } from "./integrations-section";
import { ZRExpressSection } from "./zrexpress-section";
import { WebhookEventsSection } from "./webhook-events-section";
import { FeesSection } from "./fees-section";
import { FixedFeesSection } from "./fixed-fees-section";
import { ExchangeRatesSection } from "./exchange-rates-section";
import { PricingSection } from "./pricing-section";
import { EngineRulesSection } from "./engine-rules-section";
import { MeetingScheduleSection } from "./meeting-schedule-section";
import { OptionsSection } from "./options-section";
import { StatusLabelsBlock } from "./status-labels-block";
import { AppearanceSection } from "./appearance-section";
import { SettingsTabs } from "./settings-tabs";

const NAV_SECTIONS = [
  ["workspace", "settings.workspace"],
  ["integrations", "settings.integrations"],
  ["delivery-fees", "settings.deliveryFees"],
  ["fixed-fees", "settings.fixedFees"],
  ["exchange-rates", "settings.exchangeRates"],
  ["pricing", "settings.pricing"],
  ["engine-rules", "settings.engineRules"],
  ["meeting-schedule", "settings.meetingSchedule"],
  ["options", "settings.options.navTitle"],
] as const; // appearance renders under "workspace"

type SectionId = (typeof NAV_SECTIONS)[number][0];

/** One section per view (`?section=`) — the old single page was 5 000+px
 * with ~12 Save buttons. Each section loads only its own data. */
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const requested = (await searchParams).section;
  const section: SectionId = NAV_SECTIONS.some(([id]) => id === requested) ? (requested as SectionId) : "workspace";
  const t = await getTranslations();

  return (
    <div className="space-y-6">
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />
      <SettingsTabs active="overview" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[12rem_1fr]">
        <nav aria-label={t("settings.title")} className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 text-sm lg:sticky lg:top-20 lg:mx-0 lg:block lg:h-fit lg:space-y-0.5 lg:overflow-visible lg:px-0">
          {NAV_SECTIONS.map(([id, key]) => (
            <Link
              key={id}
              href={`/app/settings?section=${id}`}
              aria-current={id === section ? "page" : undefined}
              className={cn(
                "block shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 transition-colors",
                id === section ? "bg-primary/10 font-medium text-foreground" : "text-muted-foreground hover:bg-surface-raised hover:text-foreground",
              )}
            >
              {t(key)}
            </Link>
          ))}
        </nav>

        <div className="min-w-0 space-y-6">
          <SectionBody section={section} />
        </div>
      </div>
    </div>
  );
}

async function SectionBody({ section }: { section: SectionId }) {
  const profile = await requireProfile();
  const ws = profile.workspaceId;
  const supabase = await createClient();

  switch (section) {
    case "workspace": {
      const { data } = await supabase.from("workspaces").select("name").eq("id", ws).single();
      return (
        <>
          <WorkspaceSection name={data?.name ?? ""} />
          <AppearanceSection />
        </>
      );
    }
    case "integrations": {
      const locale = await getLocale();
      const h = await headers();
      const host = h.get("host") ?? "localhost:3000";
      const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
      const baseUrl = (process.env.APP_URL ?? `${proto}://${host}`).replace(/\/$/, "");
      const [integrationsRes, zrTerritoryCountRes, webhookEventsRes] = await Promise.all([
        supabase.from("integration_configs").select("*").eq("workspace_id", ws),
        supabase.from("zr_territories").select("id", { count: "exact", head: true }).eq("workspace_id", ws),
        supabase.from("webhook_events").select("*").eq("workspace_id", ws).order("created_at", { ascending: false }).limit(20),
      ]);
      return (
        <>
          <IntegrationsSection configs={integrationsRes.data ?? []} baseUrl={baseUrl} locale={locale} />
          <ZRExpressSection
            config={(integrationsRes.data ?? []).find((c) => c.provider === "zrexpress") ?? null}
            territoryCount={zrTerritoryCountRes.count ?? 0}
          />
          <WebhookEventsSection events={webhookEventsRes.data ?? []} />
        </>
      );
    }
    case "delivery-fees": {
      const [wilayaFeesRes, wilayaStatsRes] = await Promise.all([
        supabase
          .from("wilaya_fees")
          .select("wilaya_code, home_fee, stopdesk_fee, stop_shipping, priced, stopdesk_available, updated_at, wilaya:wilayas(name)")
          .eq("workspace_id", ws)
          .order("wilaya_code"),
        // stop-shipping auto flag (dashboard computes the same thing, filtered)
        supabase.from("wilaya_stats").select("wilaya_code, stop_shipping_auto").eq("workspace_id", ws),
      ]);
      return (
        <FeesSection
          rows={wilayaFeesRes.data ?? []}
          snapshot={(wilayaFeesRes.data ?? []).reduce((m, r) => (r.updated_at > m ? r.updated_at : m), "")}
          autoFlagged={
            new Set(
              (wilayaStatsRes.data ?? [])
                .filter((s) => s.stop_shipping_auto && s.wilaya_code !== null)
                .map((s) => s.wilaya_code as number),
            )
          }
        />
      );
    }
    case "fixed-fees": {
      const [fixedFeesRes, usd, eur] = await Promise.all([
        supabase.from("fixed_fees").select("*").eq("workspace_id", ws).order("created_at"),
        supabase.rpc("current_fx_rate", { p_ws: ws, p_currency: "USD" }),
        supabase.rpc("current_fx_rate", { p_ws: ws, p_currency: "EUR" }),
      ]);
      return <FixedFeesSection fees={fixedFeesRes.data ?? []} rates={{ USD: usd.data ?? 1, EUR: eur.data ?? 1 }} />;
    }
    case "exchange-rates": {
      const [exchangeRatesRes, usd, eur] = await Promise.all([
        supabase
          .from("exchange_rates")
          .select("*")
          .eq("workspace_id", ws)
          .order("valid_from", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase.rpc("current_fx_rate", { p_ws: ws, p_currency: "USD" }),
        supabase.rpc("current_fx_rate", { p_ws: ws, p_currency: "EUR" }),
      ]);
      return <ExchangeRatesSection rates={exchangeRatesRes.data ?? []} current={{ USD: usd.data ?? null, EUR: eur.data ?? null }} />;
    }
    case "pricing": {
      const [settings, row] = await Promise.all([
        getSetting(ws, "pricing_defaults"),
        supabase.from("settings").select("key").eq("workspace_id", ws).eq("key", "pricing_defaults").maybeSingle(),
      ]);
      return <PricingSection settings={settings} saved={row.data !== null} />;
    }
    case "engine-rules": {
      const [returnFee, duplicateWindow, riskWeights, stopShippingRule] = await Promise.all([
        getSetting(ws, "return_fee"),
        getSetting(ws, "duplicate_window"),
        getSetting(ws, "risk_weights"),
        getSetting(ws, "stop_shipping_rule"),
      ]);
      return (
        <EngineRulesSection returnFee={returnFee} duplicateWindow={duplicateWindow} riskWeights={riskWeights} stopShippingRule={stopShippingRule} />
      );
    }
    case "meeting-schedule":
      return <MeetingScheduleSection meetingSchedule={await getSetting(ws, "meeting_schedule")} />;
    case "options": {
      const optionSets = await getAllOptionSets(ws);
      const optionUsage = Object.fromEntries(
        await Promise.all(optionSets.map(async (s) => [s.key, await getOptionUsageCounts(ws, s.key)])),
      ) as Record<OptionSetKey, Record<string, number>>;
      return (
        <>
          <OptionsSection sets={optionSets} usage={optionUsage} />
          <StatusLabelsBlock workspaceId={ws} />
        </>
      );
    }
  }
}
