import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { asKpiGroup } from "@/lib/kpi";
import { ISO_DATE, type DashboardFilters } from "@/lib/query-string";
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

  const filters: DashboardFilters = {
    from: ISO_DATE.test(get("from")) ? get("from") : undefined,
    to: ISO_DATE.test(get("to")) ? get("to") : undefined,
    product: get("product") || undefined,
  };
  const { data: products } = await supabase.from("products").select("id, name").order("name");
  // An unknown product id (deleted, mistyped) is dropped rather than filtering to nothing.
  if (filters.product && !(products ?? []).some((p) => p.id === filters.product)) filters.product = undefined;
  const productOpts: Opt[] = (products ?? []).map((p) => ({ value: p.id, label: p.name }));

  const { data, error } = await supabase.rpc("kpi_by_wilaya", {
    p_from: filters.from,
    p_to: filters.to,
    p_product: filters.product ? [filters.product] : undefined,
  });
  if (error) throw new Error(`kpi_by_wilaya: ${error.message}`);

  const rows: StatsRow[] = (data ?? [])
    .flatMap((r) => {
      const group = asKpiGroup(r.rates, r.extras);
      return group ? [{ code: r.wilaya_code, name: r.wilaya_name, group }] : [];
    })
    .sort((a, b) => b.group.rates.counts.received - a.group.rates.counts.received || (a.code ?? 999) - (b.code ?? 999));

  // ?wilaya=: one open at a time; a value that is not a wilaya of the result is ignored.
  const wantedWilaya = /^\d{1,2}$/.test(get("wilaya")) ? Number(get("wilaya")) : null;
  const open = wantedWilaya === null ? null : rows.find((r) => r.code === wantedWilaya) ?? null;

  const keep = new URLSearchParams();
  for (const k of ["from", "to", "product"] as const) if (filters[k]) keep.set(k, filters[k]!);
  const baseHref = `/app/statistics${keep.size ? `?${keep.toString()}` : ""}`;
  const retryHref = open ? `${baseHref}${keep.size ? "&" : "?"}wilaya=${wantedWilaya}` : baseHref;
  const widenHref = (() => {
    const p = new URLSearchParams();
    if (filters.product) p.set("product", filters.product);
    return `/app/statistics${p.size ? `?${p.toString()}` : ""}`;
  })();
  const clearProductHref = (() => {
    const p = new URLSearchParams();
    if (filters.from) p.set("from", filters.from);
    if (filters.to) p.set("to", filters.to);
    return `/app/statistics${p.size ? `?${p.toString()}` : ""}`;
  })();

  const names = Object.fromEntries(rows.flatMap((r) => (r.code !== null && r.name ? [[r.code, r.name] as const] : [])));

  return (
    <div className="space-y-6">
      <PageHeader title={t("statistics.title")} subtitle={t("statistics.subtitle")} />

      <DashboardFilterBar products={productOpts} />

      {rows.length === 0 ? (
        <Empty>
          <p className="font-medium text-foreground">{t("statistics.emptyTitle")}</p>
          <p className="mt-1">{t("statistics.emptyBody")}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {filters.from || filters.to ? <ButtonLink href={widenHref} size="sm">{t("statistics.widenPeriod")}</ButtonLink> : null}
            {filters.product ? <ButtonLink href={clearProductHref} size="sm" variant="outline">{t("statistics.clearProduct")}</ButtonLink> : null}
            {!filters.from && !filters.to && !filters.product ? <ButtonLink href="/app/orders/all" size="sm">{t("statistics.allOrders")}</ButtonLink> : null}
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
                <CommunePanel wilaya={wantedWilaya} group={open.group} filters={filters} retryHref={retryHref} />
              </Suspense>
            ) : null
          }
        />
      )}
    </div>
  );
}
