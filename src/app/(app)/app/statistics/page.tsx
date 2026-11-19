import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { asKpiGroup } from "@/lib/kpi";
import { kpiFiltersJson, parseStatsFilters, statsDrillFilters } from "@/lib/query-string";
import { periodYears, resolveSeason, seasonLabel, type SeasonRow } from "@/lib/seasons";
import { PageHeader } from "@/components/page-header";
import { ButtonLink } from "@/components/button-link";
import { Empty } from "@/components/empty";
import { WilayaSection, type StatsRow } from "@/components/stats/wilaya-section";
import { CommunePanel, CommunePanelSkeleton } from "@/components/stats/commune-panel";
import { SeasonCompare, SeasonCompareSkeleton } from "@/components/stats/season-compare";
import { StatsFilterBar, type StatsOpt } from "@/components/stats/stats-filter-bar";
import { getOptionSet } from "@/lib/option-sets";
import { getProfile } from "@/lib/rbac";
import { ORDER_SOURCES, DELIVERY_TYPES } from "@/lib/enums";

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
  const productOpts: StatsOpt[] = (products ?? []).map((p) => ({ value: p.id, label: p.name }));
  const { workspaceId } = (await getProfile())!;
  const [categoryOptions, { data: wilayaRows }, { data: team }] = await Promise.all([
    getOptionSet(workspaceId, "product_category"),
    supabase.from("wilayas").select("code, name").order("code"),
    supabase.from("profiles").select("user_id, display_name, role").eq("is_active", true),
  ]);
  const categoryOpts: StatsOpt[] = categoryOptions.filter((o) => !o.archived_at).map((o) => ({ value: o.id, label: o.label }));
  const wilayaOpts: StatsOpt[] = (wilayaRows ?? []).map((w) => ({ value: String(w.code), label: `${w.code} — ${w.name}` }));
  const agentOpts: StatsOpt[] = (team ?? [])
    .filter((a) => a.role !== "delivery_agent")
    .map((a) => ({ value: a.user_id, label: a.display_name ?? a.user_id.slice(0, 8) }));
  // Values that match no option (deactivated agent, archived category) are dropped, never applied invisibly.
  if (f.category && !categoryOpts.some((o) => o.value === f.category)) f.category = undefined;
  if (f.agent && !agentOpts.some((o) => o.value === f.agent)) f.agent = undefined;
  const sourceOpts: StatsOpt[] = ORDER_SOURCES.map((s) => ({ value: s, label: t(`status.order_source.${s}`) }));
  const deliveryOpts: StatsOpt[] = DELIVERY_TYPES.map((d) => ({ value: d, label: t(`statistics.${d}`) }));

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
  const seasonOpts = seasons.map((s) => ({ id: s.id, label: seasonLabel(t, s), years: periodYears(s) }));
  const notes: string[] = [];
  const parsed: [string, string, unknown][] = [
    ["product", t("fields.product"), f.product],
    ["f_category", t("fields.category"), f.category],
    ["f_wilaya", t("fields.wilaya"), f.wilaya],
    ["f_source", t("fields.source"), f.source],
    ["f_agent", t("fields.agent"), f.agent],
    ["f_delivery", t("statistics.filters.deliveryType"), f.delivery],
  ];
  for (const [param, label, value] of parsed)
    if (get(param) && value === undefined) notes.push(t("statistics.filters.dropped", { name: label }));
  if (seasonError) notes.push(t("statistics.filters.seasonsError"));
  else if (season.invalid.season) notes.push(t("statistics.filters.invalidSeason"));
  if (season.invalid.year) notes.push(t("statistics.filters.invalidYear"));
  if (season.invalid.noPeriods) notes.push(t("statistics.filters.noPeriods"));
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
  const yearHref = (year: number) => {
    const p = new URLSearchParams(keep);
    for (const k of ["from", "to"]) p.delete(k);
    p.set("season", season.season!.id);
    p.set("year", String(year));
    return `/app/statistics?${p.toString()}`;
  };
  const retryHref = open ? `${baseHref}${keep.size ? "&" : "?"}wilaya=${wantedWilaya}` : baseHref;

  const names = Object.fromEntries(rows.flatMap((r) => (r.code !== null && r.name ? [[r.code, r.name] as const] : [])));

  return (
    <div className="space-y-6">
      <PageHeader title={t("statistics.title")} subtitle={t("statistics.subtitle")} />

      <StatsFilterBar
        products={productOpts}
        categories={categoryOpts}
        wilayas={wilayaOpts}
        sources={sourceOpts}
        agents={agentOpts}
        deliveryTypes={deliveryOpts}
        seasons={seasonOpts}
        overridden={season.overridden}
        seasonRange={{ from: range.from ?? "", to: range.to ?? "" }}
        notes={notes}
        active={f}
      />

      {season.season ? (
        <Suspense fallback={<SeasonCompareSkeleton />}>
          <SeasonCompare
            season={season.season}
            selectedYear={season.overridden ? null : season.period?.year ?? null}
            product={f.product}
            pFilters={pFilters}
            hrefForYear={yearHref}
            retryHref={baseHref}
          />
        </Suspense>
      ) : null}

      {seasonError ? (
        <Empty>
          <div role="alert">
            <p className="font-medium text-foreground">{t("statistics.filters.seasonsError")}</p>
            <div className="mt-4 flex justify-center">
              <ButtonLink href={baseHref} size="sm">{t("statistics.retry")}</ButtonLink>
            </div>
          </div>
        </Empty>
      ) : null}

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
