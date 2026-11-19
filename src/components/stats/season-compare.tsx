import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import type { KpiGroupRates } from "@/lib/kpi";
import type { SeasonRow } from "@/lib/seasons";
import { seasonLabel } from "@/lib/seasons";
import { ButtonLink } from "@/components/button-link";
import { Empty } from "@/components/empty";
import { MetricCell } from "@/components/stats/metric-cell";
import { formatInt } from "@/lib/format";
import { cn } from "@/lib/utils";

const MAX_YEARS = 5;

/** Skeleton while the per-year rates stream in (own Suspense, the wilaya table stays usable). */
export function SeasonCompareSkeleton() {
  const bar = "animate-pulse rounded-md bg-border";
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="card-surface space-y-3 rounded-xl p-4">
          <div className={`${bar} h-5 w-24`} />
          <div className={`${bar} h-8 w-full`} />
          <div className={`${bar} h-8 w-full`} />
        </div>
      ))}
    </div>
  );
}

/**
 * The same season across its years: one `kpi_set_rates` call per year (same order set, same
 * non-period filters, D4), newest first. A year that fails shows its own error, not the page's.
 */
export async function SeasonCompare({
  season,
  selectedYear,
  product,
  pFilters,
  hrefForYear,
  retryHref,
}: {
  season: SeasonRow;
  selectedYear: number | null;
  product?: string;
  pFilters?: Record<string, string>;
  /** statistics URL for one year (other filters kept, explicit dates dropped) */
  hrefForYear: (year: number) => string;
  retryHref: string;
}) {
  const t = await getTranslations();
  const supabase = await createClient();
  const periods = [...season.periods].sort((a, b) => b.year - a.year);
  const shown = periods.slice(0, MAX_YEARS);

  if (periods.length === 0) {
    return (
      <Empty className="p-6">
        <p>{t("statistics.compare.noPeriods", { name: seasonLabel(t, season) })}</p>
        <div className="mt-3 flex justify-center">
          <ButtonLink href="/app/settings/seasons" size="sm" variant="outline">{t("statistics.compare.openSettings")}</ButtonLink>
        </div>
      </Empty>
    );
  }

  const results = await Promise.all(
    shown.map(async (p) => {
      const { data, error } = await supabase.rpc("kpi_set_rates", {
        p_from: p.date_from,
        p_to: p.date_to,
        p_product: product ? [product] : undefined,
        p_filters: pFilters,
      });
      if (error) console.error("statistics/season-compare", error.message);
      const rates = !error && data && typeof data === "object" && "counts" in data && "delivery" in data ? (data as unknown as KpiGroupRates) : null;
      return { period: p, rates, failed: !!error || !rates };
    }),
  );
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Algiers" });
  const notEnough = t("statistics.notEnoughData");

  return (
    <section aria-labelledby="season-compare-title" className="space-y-3">
      <h2 id="season-compare-title" className="text-sm font-semibold">
        {t("statistics.compare.title", { name: seasonLabel(t, season) })}
      </h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {results.map(({ period, rates, failed }) => {
          const current = period.year === selectedYear;
          return (
            <li
              key={period.year}
              aria-current={current ? "true" : undefined}
              className={cn("card-surface space-y-3 rounded-xl p-4", current && "ring-2 ring-primary")}
            >
              <div className="flex items-baseline justify-between gap-2">
                <Link
                  href={hrefForYear(period.year)}
                  className="rounded-sm text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <bdi dir="ltr">{period.year}</bdi>
                </Link>
                {current ? (
                  <span className="text-xs font-medium text-primary">{t("statistics.compare.selected")}</span>
                ) : rates && period.date_to >= today ? (
                  <span className="text-xs text-muted-foreground">{t("statistics.compare.inProgress")}</span>
                ) : null}
              </div>
              {failed || !rates ? (
                <div role="alert" className="space-y-2 text-sm">
                  <p className="text-foreground">{t("statistics.compare.yearError", { year: period.year })}</p>
                  <ButtonLink href={retryHref} size="sm">{t("statistics.retry")}</ButtonLink>
                </div>
              ) : rates.counts.received === 0 ? (
                <p className="text-sm text-muted-foreground">{t("statistics.compare.noOrders")}</p>
              ) : (
                <dl className="space-y-2 text-xs">
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-muted-foreground">{t("statistics.received")}</dt>
                    <dd className="num text-sm font-medium"><bdi dir="ltr">{formatInt(rates.counts.received)}</bdi></dd>
                  </div>
                  {([
                    ["confirmation", rates.confirmation],
                    ["delivery", rates.delivery],
                    ["returnRate", rates.return],
                  ] as const).map(([key, m]) => (
                    <div key={key} className="flex items-center justify-between gap-2">
                      <dt className="text-muted-foreground">{t(`statistics.${key}`)}</dt>
                      <dd><MetricCell m={m} title={notEnough} /></dd>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          );
        })}
      </ul>
      {periods.length > MAX_YEARS ? (
        <p className="text-xs text-muted-foreground">{t("statistics.compare.more", { shown: MAX_YEARS, total: periods.length })}</p>
      ) : null}
    </section>
  );
}
