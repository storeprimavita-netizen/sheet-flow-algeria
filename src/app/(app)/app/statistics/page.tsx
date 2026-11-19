import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AlertTriangle } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { asWilayaStats } from "@/lib/kpi";
import type { DashboardFilters } from "@/lib/query-string";
import { PageHeader } from "@/components/page-header";
import { Empty } from "@/components/empty";
import { ButtonLink } from "@/components/button-link";
import { RetryButton } from "@/components/dashboard/band-retry";
import { DashboardFilterBar, type Opt } from "@/components/dashboard/dashboard-filter-bar";
import { WilayaSection } from "@/components/stats/wilaya-section";
import { CommunePanel } from "./_components/commune-panel";

// Statistics (STATS-2, D64): admin-only (AdminGuardLayout). Every rate is SQL
// (kpi_by_wilaya / kpi_by_commune over kpi_rates); no formula lives here.

const qs = (f: DashboardFilters) => {
  const p = new URLSearchParams();
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (f.product) p.set("product", f.product);
  return p.size ? `?${p.toString()}` : "";
};

export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" && sp[k] ? (sp[k] as string) : "");
  const t = await getTranslations("statistics");
  const supabase = await createClient();

  const filters: DashboardFilters = { from: get("from") || undefined, to: get("to") || undefined, product: get("product") || undefined };
  const [products, wilayas] = await Promise.all([
    supabase.from("products").select("id, name").order("name"),
    supabase.from("wilayas").select("code, name").order("code"),
  ]);
  // An unknown product id is dropped rather than filtering to nothing.
  if (filters.product && !(products.data ?? []).some((p) => p.id === filters.product)) filters.product = undefined;

  const { data, error } = await supabase.rpc("kpi_by_wilaya", {
    p_from: filters.from,
    p_to: filters.to,
    p_product: filters.product ? [filters.product] : undefined,
  });

  const unknownLabel = t("unknownWilaya");
  const names = Object.fromEntries((wilayas.data ?? []).map((w) => [w.code, w.name]));
  const rows = asWilayaStats(data).map((w) => ({ ...w, label: w.name ?? unknownLabel }));

  // ?wilaya= opens one wilaya; anything that is not a listed wilaya is ignored.
  const wantedRaw = /^\d{1,2}$/.test(get("wilaya")) ? Number(get("wilaya")) : null;
  const open = wantedRaw === null ? null : (rows.find((w) => w.code === wantedRaw) ?? null);

  const productOpts: Opt[] = (products.data ?? []).map((p) => ({ value: p.id, label: p.name }));
  const withoutDates = qs({ product: filters.product });
  const withoutProduct = qs({ from: filters.from, to: filters.to });

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("purpose")} />
      <DashboardFilterBar products={productOpts} />

      {error ? (
        <div role="alert" className="card-surface flex flex-wrap items-center justify-center gap-3 rounded-xl p-10 text-sm">
          <AlertTriangle className="h-4 w-4 text-danger" />
          <span>{t("loadError")}</span>
          <RetryButton label={t("retry")} />
        </div>
      ) : rows.length === 0 ? (
        <Empty>
          <p className="font-medium text-foreground">{t("emptyTitle")}</p>
          <p className="mt-1">{t("emptyHint")}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {filters.from || filters.to ? (
              <ButtonLink href={`/app/statistics${withoutDates}`} size="sm">{t("widenPeriod")}</ButtonLink>
            ) : null}
            {filters.product ? (
              <ButtonLink href={`/app/statistics${withoutProduct}`} size="sm">{t("clearProduct")}</ButtonLink>
            ) : null}
          </div>
        </Empty>
      ) : (
        <WilayaSection
          rows={rows}
          filters={filters}
          expanded={open?.code ?? null}
          names={names}
          panel={
            open && open.code !== null ? (
              <Suspense key={`${open.code}${qs(filters)}`} fallback={<PanelSkeleton />}>
                <CommunePanel wilaya={open.code} wilayaLabel={open.label} extras={open.extras} filters={filters} />
              </Suspense>
            ) : null
          }
        />
      )}
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      <div className="h-4 w-40 animate-pulse rounded-md bg-border" />
      <div className="h-10 w-full animate-pulse rounded-md bg-border" />
      <div className="h-24 w-full animate-pulse rounded-md bg-border" />
    </div>
  );
}
