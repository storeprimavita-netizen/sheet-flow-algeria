import Link from "next/link";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { formatInt } from "@/lib/format";
import { kpiPct, type GroupExtras, type KpiMetric } from "@/lib/kpi";
import { RateCell } from "@/components/stats/rate-bar";

/**
 * One rate of a statistics row: bar + percent, and the visible "n of N" under it
 * (num links to the exact orders behind it). Unmatured rates (SQL `matured`)
 * get a neutral bar and a "not enough data" hint, never a status colour.
 */
export function RateStat({ metric, href }: { metric: KpiMetric; href?: string }) {
  const t = useTranslations("statistics");
  const pct = kpiPct(metric);
  const num = href ? (
    <Link href={href} className="underline-offset-2 hover:underline">
      {formatInt(metric.num)}
    </Link>
  ) : (
    <span>{formatInt(metric.num)}</span>
  );
  return (
    <div className="space-y-0.5" title={metric.matured ? undefined : t("notEnoughData")}>
      <RateCell pct={pct ?? 0} label={pct === null ? "—" : `${pct}%`} matured={metric.matured} labelWidth="w-12" />
      <div className="num text-xs text-muted-foreground">
        <bdi dir="ltr">
          {num}
          <span> / </span>
          <span>{formatInt(metric.den)}</span>
        </bdi>
        {metric.matured ? null : <span className="ms-2">{t("notEnoughData")}</span>}
      </div>
    </div>
  );
}

/** Link + count cell ("received"): the number links to its orders. */
export function CountLink({ n, href }: { n: number; href?: string }) {
  return href ? (
    <Link href={href} className="num underline-offset-2 hover:underline">
      {formatInt(n)}
    </Link>
  ) : (
    <span className="num">{formatInt(n)}</span>
  );
}

/** Avg days + home / stop-desk split over shipped parcels (null shares when none shipped). */
export function GroupExtrasLine({
  extras,
  homeHref,
  stopdeskHref,
  className,
}: {
  extras: GroupExtras;
  homeHref?: string;
  stopdeskHref?: string;
  className?: string;
}) {
  const t = useTranslations("statistics");
  const share = (n: number) => `${Math.round((n / extras.shipped) * 100)}%`;
  const item = (label: string, value: React.ReactNode) => (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="num text-sm">{value}</dd>
    </div>
  );
  const split = (n: number, href?: string) =>
    extras.shipped === 0 ? (
      "—"
    ) : (
      <bdi dir="ltr">
        <CountLink n={n} href={href} /> <span className="text-muted-foreground">({share(n)})</span>
      </bdi>
    );
  return (
    <dl className={cn("grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4", className)}>
      {item(
        t("avgDays"),
        extras.avg_days_to_deliver === null ? (
          "—"
        ) : (
          <>
            <bdi dir="ltr">{extras.avg_days_to_deliver.toFixed(1)}</bdi>
            <span className="ms-2 text-xs text-muted-foreground">{t("avgDaysSample", { n: extras.avg_days_sample })}</span>
          </>
        ),
      )}
      {item(t("homeCount"), split(extras.home_count, homeHref))}
      {item(t("stopdeskCount"), split(extras.stopdesk_count, stopdeskHref))}
      {item(t("shipped"), extras.shipped === 0 ? t("noShipped") : <bdi dir="ltr">{formatInt(extras.shipped)}</bdi>)}
    </dl>
  );
}
