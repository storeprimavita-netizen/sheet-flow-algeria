import Link from "next/link";
import { cn } from "@/lib/utils";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { asKpiGroup, type KpiGroup, type KpiGroupExtras } from "@/lib/kpi";
import { communeLinkable, drillHref, type DashboardFilters } from "@/lib/query-string";
import { ButtonLink } from "@/components/button-link";
import { Empty } from "@/components/empty";
import { tableClass } from "@/components/field";
import { MetricCell, DRILL_LINK } from "@/components/stats/metric-cell";

/** Skeleton shown while the commune rows stream in (own Suspense, the wilaya table stays usable). */
export function CommunePanelSkeleton() {
  const bar = "animate-pulse rounded-md bg-border";
  return (
    <div className="space-y-2 p-4" aria-busy="true">
      <div className={`${bar} h-4 w-64 max-w-full`} />
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className={`${bar} h-8 w-full`} />
      ))}
    </div>
  );
}

function ExtrasLine({
  extras,
  t,
  typeHref,
}: {
  extras: KpiGroupExtras;
  t: Awaited<ReturnType<typeof getTranslations>>;
  /** shipped-orders drill of one delivery type (undefined = no link) */
  typeHref?: (type: "home" | "stopdesk") => string | undefined;
}) {
  const count = (type: "home" | "stopdesk", n: number) => {
    const href = typeHref?.(type);
    return href && n > 0 ? <Link href={href} className={DRILL_LINK}>{n}</Link> : n;
  };
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
      <div className="flex gap-1">
        <dt>{t("statistics.avgDays")}</dt>
        <dd className="num text-foreground">
          {extras.avg_days_to_deliver === null ? (
            "—"
          ) : (
            <>
              <bdi dir="ltr">{extras.avg_days_to_deliver}</bdi> <span className="text-muted-foreground">({t("statistics.sample", { n: extras.avg_days_sample })})</span>
            </>
          )}
        </dd>
      </div>
      <div className="flex gap-1">
        <dt>{t("statistics.home")}</dt>
        <dd className="num text-foreground"><bdi dir="ltr">{extras.shipped > 0 ? <>{count("home", extras.home_count)}/{extras.shipped}</> : "—"}</bdi></dd>
      </div>
      <div className="flex gap-1">
        <dt>{t("statistics.stopdesk")}</dt>
        <dd className="num text-foreground"><bdi dir="ltr">{extras.shipped > 0 ? <>{count("stopdesk", extras.stopdesk_count)}/{extras.shipped}</> : "—"}</bdi></dd>
      </div>
    </dl>
  );
}

/** Commune drill-down of one wilaya: its extras, then one row per commune (`kpi_by_commune`). */
export async function CommunePanel({
  wilaya,
  group,
  filters,
  pFilters,
  retryHref,
}: {
  wilaya: number;
  group: KpiGroup;
  filters: DashboardFilters;
  /** `p_filters` of the SQL set (kpiFiltersJson) */
  pFilters?: Record<string, string>;
  retryHref: string;
}) {
  const t = await getTranslations();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("kpi_by_commune", {
    p_wilaya: wilaya,
    p_from: filters.from,
    p_to: filters.to,
    p_product: filters.product ? [filters.product] : undefined,
    p_filters: pFilters,
  });

  if (error) {
    console.error("statistics/communes", error.message);
    return (
      <div className="space-y-3 p-4" role="alert">
        <p className="text-sm font-medium text-foreground">{t("statistics.communeError")}</p>
        <ButtonLink href={retryHref} size="sm">{t("statistics.retry")}</ButtonLink>
      </div>
    );
  }

  const rows = (data ?? [])
    .flatMap((r) => {
      const g = asKpiGroup(r.rates, r.extras);
      return g ? [{ key: r.commune_key, name: r.commune, g }] : [];
    })
    .sort((a, b) => b.g.rates.counts.received - a.g.rates.counts.received || (a.name ?? "").localeCompare(b.name ?? ""));
  const notEnough = t("statistics.notEnoughData");

  return (
    <div className="sticky start-0 max-w-[calc(100vw-2rem)] space-y-3 p-4 max-sm:p-1.5">
      <ExtrasLine
        extras={group.extras}
        t={t}
        typeHref={(type) => drillHref(filters, "shipped", { wilaya, deliveryType: type })}
      />
      {rows.length === 0 ? (
        <Empty className="p-6">{t("statistics.noCommunes")}</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className={cn(tableClass, "max-sm:[&_td]:px-1 max-sm:[&_th]:px-1 max-sm:[&_th]:text-[10px] max-sm:text-xs")}>
            <thead>
              <tr>
                <th className="sticky start-0 z-[1] bg-surface">{t("statistics.commune")}</th>
                <th className="text-end">{t("statistics.received")}</th>
                <th>{t("statistics.confirmation")}</th>
                <th>{t("statistics.delivery")}</th>
                <th>{t("statistics.returnRate")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const { counts } = r.g.rates;
                // a key the drill would reject is never linked (the count stays plain text)
                const linkable = r.key === null || communeLinkable(r.key);
                const href = (m: Parameters<typeof drillHref>[1], deliveryType?: string) =>
                  linkable ? drillHref(filters, m, { wilaya, communeKey: r.key, communeLabel: r.name ?? undefined, deliveryType }) : undefined;
                return (
                  <tr key={r.key ?? "\u0000unknown"}>
                    <td className="sticky start-0 z-[1] bg-surface">
                      <div className="whitespace-nowrap">{r.key === null ? <span className="text-muted-foreground">{t("statistics.unknownCommune")}</span> : <bdi>{r.name}</bdi>}</div>
                      <div className="mt-1 max-w-56 whitespace-normal"><ExtrasLine extras={r.g.extras} t={t} typeHref={(type) => href("shipped", type)} /></div>
                    </td>
                    <td className="num text-end">
                      {counts.received > 0 && href("received") ? <Link href={href("received")!} className={DRILL_LINK}>{counts.received}</Link> : counts.received}
                    </td>
                    <td className="sm:min-w-32"><MetricCell m={r.g.rates.confirmation} numHref={href("confirmed")} title={notEnough} /></td>
                    <td className="sm:min-w-32"><MetricCell m={r.g.rates.delivery} numHref={href("delivered")} title={notEnough} /></td>
                    <td className="sm:min-w-32"><MetricCell m={r.g.rates.return} numHref={href("return")} title={notEnough} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
