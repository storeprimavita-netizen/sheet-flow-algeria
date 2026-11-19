import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { asKpiGroup } from "@/lib/kpi";
import { kpiFiltersJson, parseStatsFilters, statsDrillFilters } from "@/lib/query-string";
import { resolveSeason, type SeasonRow } from "@/lib/seasons";
import { PageHeader } from "@/components/page-header";
import { ButtonLink } from "@/components/button-link";
import { Empty } from "@/components/empty";
import { WilayaSection, type StatsRow } from "@/components/stats/wilaya-section";
import { CommunePanel, CommunePanelSkeleton } from "@/components/stats/commune-panel";
import { DashboardFilterBar, type Opt } from "../dashboard/dashboard-filter-bar";

// Per-wilaya confirmation/delivery table + commune drill-down (STATS-2, D64).
// Admin-only (layout guard). Every figure is a SQL rate (kpi_by_wilaya / kpi_by_commune
// over kpi_rates, D4); no formula lives here.

export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" && sp[k] ? (sp[k] as string) : "");
  const t = await getTranslations();
  const supabase = await createClient();

  const f = parseStatsFilters(get);
  const { data: products } = await supabase.from("products").select("id, name").order("name");
  // An unknown product id (deleted, mistyped) is dropped rather than filtering to nothing.
  if (f.product && !(products ?? []).some((p) => p.id === f.product)) f.product = undefined;
  const productOpts: Opt[] = (products ?? []).map((p) => ({ value: p.id, label: p.name }));

  const { data: seasonData, error: seasonError } = await supabase
    .from("seasons")
    .select("id, name, name_key, sort, season_periods(year, date_from, date_to)")
    .order("sort");
  if (seasonError) console.error("statistics/seasons", seasonError.message);
  const seasons: SeasonRow[] = (seasonData ?? []).map((s) => ({
    id: s.id, name: s.name, name_key: s.name_key, sort: s.sort, periods: s.season_periods ?? [],
  }));
  const season = resolveSeason({ season: f.season, year: f.year, from: f.from, to: f.to }, seasons);
  const range = { from: season.from, to: season.to };
  const pFilters = kpiFiltersJson(f);
  const filters = statsDrillFilters(f, range);

  const { data, error } = await supabase.rpc("kpi_by_wilaya", {
    p_from: range.from,
    p_to: range.to,
    p_product: f.product ? [f.product] : undefined,
    p_filters: pFilters,
  });
  if (error) console.error("statistics/kpi_by_wilaya", error.message);

  const rows: StatsRow[] = (data ?? [])
    .flatMap((r) => {
      const group = asKpiGroup(r.rates, r.extras);
      return group ? [{ code: r.wilaya_code, name: r.wilaya_name, group }] : [];
    })
    .sort((a, b) => b.group.rates.counts.received - a.group.rates.counts.received || (a.code ?? 999) - (b.code ?? 999));

  // ?wilaya=: one open at a time; a value that is not a wilaya of the result is ignored.
  const wantedWilaya = /^\d{1,2}$/.test(get("wilaya")) ? Number(get("wilaya")) : null;
  const open = wantedWilaya === null ? null : rows.find((r) => r.code === wantedWilaya) ?? null;

  // every filter param stays in the links; only the open drill panel is dropped
  const keep = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v && k !== "wilaya") keep.set(k, v);
  const baseHref = `/app/statistics${keep.size ? `?${keep.toString()}` : ""}`;
  const retryHref = open ? `${baseHref}${keep.size ? "&" : "?"}wilaya=${wantedWilaya}` : baseHref;

  const names = Object.fromEntries(rows.flatMap((r) => (r.code !== null && r.name ? [[r.code, r.name] as const] : [])));

  return (
    <div className="space-y-6">
      <PageHeader title={t("statistics.title")} subtitle={t("statistics.subtitle")} />

      <DashboardFilterBar products={productOpts} />

      {error ? (
        <Empty>
          <div role="alert">
            <p className="font-medium text-foreground">{t("statistics.loadError")}</p>
            <div className="mt-4 flex justify-center">
              <ButtonLink href={baseHref} size="sm">{t("statistics.retry")}</ButtonLink>
            </div>
          </div>
        </Empty>
      ) : rows.length === 0 ? (
        <Empty>
          <p className="font-medium text-foreground">{t("statistics.emptyTitle")}</p>
          <p className="mt-1">{t("statistics.emptyBody")}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {keep.size ? (
              <ButtonLink href="/app/statistics" size="sm">{t("statistics.clearFilters")}</ButtonLink>
            ) : (
              <ButtonLink href="/app/orders/all" size="sm">{t("statistics.allOrders")}</ButtonLink>
            )}
          </div>
        </Empty>
      ) : (
        <WilayaSection
          rows={rows}
          filters={filters}
          openWilaya={open?.code ?? null}
          names={names}
          panel={
            open && wantedWilaya !== null ? (
              <Suspense fallback={<CommunePanelSkeleton />}>
                <CommunePanel wilaya={wantedWilaya} group={open.group} filters={filters} pFilters={pFilters} retryHref={retryHref} />
              </Suspense>
            ) : null
          }
        />
      )}
    </div>
  );
}
