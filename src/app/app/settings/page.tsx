import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/rbac";
import { getSetting } from "@/lib/settings";
import { PageHeader } from "@/components/page-header";

import { WorkspaceSection } from "./workspace-section";
import { IntegrationsSection } from "./integrations-section";
import { FeesSection } from "./fees-section";
import { FixedFeesSection } from "./fixed-fees-section";
import { ExchangeRatesSection } from "./exchange-rates-section";
import { ThresholdsSection } from "./thresholds-section";

export default async function SettingsPage() {
  const t = await getTranslations();
  const profile = (await getProfile())!;
  const supabase = await createClient();

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = (process.env.APP_URL ?? `${proto}://${host}`).replace(/\/$/, "");

  const [
    workspaceRes,
    integrationsRes,
    wilayaFeesRes,
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
      .from("wilaya_fees")
      .select("wilaya_code, home_fee, stopdesk_fee, stop_shipping, wilaya:wilayas(name)")
      .eq("workspace_id", profile.workspaceId)
      .order("wilaya_code"),
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

  return (
    <div className="space-y-6">
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />
      <WorkspaceSection name={workspaceRes.data?.name ?? ""} />
      <IntegrationsSection configs={integrationsRes.data ?? []} baseUrl={baseUrl} />
      <FeesSection rows={wilayaFeesRes.data ?? []} />
      <FixedFeesSection fees={fixedFeesRes.data ?? []} />
      <ExchangeRatesSection
        rates={exchangeRatesRes.data ?? []}
        current={{ USD: usdRateRes.data ?? null, EUR: eurRateRes.data ?? null }}
      />
      <ThresholdsSection
        returnFee={returnFee}
        duplicateWindow={duplicateWindow}
        riskWeights={riskWeights}
        stopShippingRule={stopShippingRule}
        meetingSchedule={meetingSchedule}
      />
    </div>
  );
}
