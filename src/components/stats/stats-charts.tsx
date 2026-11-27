import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { asKpiDaily, kpiPct, type KpiGroupRates, type KpiMetric } from "@/lib/kpi";
import { worstFirst, collapseSlices } from "@/lib/chart-math";
import { formatInt, formatPercent } from "@/lib/format";
import { drillHref, ordersQs, type DashboardFilters } from "@/lib/query-string";
import { BarChart, type BarItem } from "@/components/charts/bar-chart";
import { ChartLoadError, ChartPanel, ChartSkeleton } from "@/components/charts/chart-panel";
import { DonutChart } from "@/components/charts/donut-chart";
import { LineChart, type LineSeries, type LineX } from "@/components/charts/line-chart";
import type { StatsRow } from "@/components/stats/wilaya-section";
import { tableClass } from "@/components/field";
import { RateBar } from "@/components/stats/rate-bar";

/** Floor for "worst first": a wilaya or product with fewer orders says nothing about its rate. */
const MIN_ORDERS = 10;
const TOP = 10;

type Scope = { from?: string; to?: string; product?: string; wilayaName?: string; pFilters: Record<string, string> | undefined; filters: DashboardFilters };
const rpcArgs = (s: Scope) => ({ p_from: s.from, p_to: s.to, p_product: s.product ? [s.product] : undefined, p_filters: s.pFilters });
const emptyOrders = (title: string, action: string) => ({ title, action: { label: action, href: "/app/sell/orders" } });

/** One section of the Statistics page: a heading and its charts. */
export function StatSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

const fallback = (h = 220) => <ChartSkeleton height={h} />;

async function DailyCharts({ scope }: { scope: Scope }) {
  const t = await getTranslations("statistics.charts");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("kpi_daily", rpcArgs(scope));
  if (error) {
    console.error("statistics/kpi_daily", error.message);
    return (
      <>
        <ChartLoadError title={t("ordersPerDay")} />
        <ChartLoadError title={t("rates")} />
      </>
    );
  }
  const days = asKpiDaily(data);
  const xs: LineX[] = days.map((d) => ({
    key: d.day,
    label: `${d.day.slice(8, 10)}/${d.day.slice(5, 7)}/${d.day.slice(0, 4)}`,
    short: `${d.day.slice(8, 10)}/${d.day.slice(5, 7)}`,
    immature: d.immature,
    href: ordersQs({ ...scope.filters, from: d.day, to: d.day }, { drill: "received" }),
  }));
  const empty = days.length ? null : emptyOrders(t("emptyDaily"), t("allOrders"));
  const orders: LineSeries[] = [
    { key: "received", label: t("received"), color: "var(--chart-1)", marker: "circle", values: days.map((d) => d.rates.counts.received), format: "int" },
  ];
  const pct = (m: KpiGroupRates["confirmation"]) => kpiPct(m);
  const rates: LineSeries[] = [
    { key: "confirmation", label: t("confirmation"), color: "var(--chart-1)", marker: "circle", values: days.map((d) => pct(d.rates.confirmation)), format: "percent" },
    { key: "delivery", label: t("delivery"), color: "var(--chart-2)", dash: "6 4", marker: "square", values: days.map((d) => pct(d.rates.delivery)), format: "percent" },
  ];
  const notes = [days.length >= 366 ? t("windowNote", { n: days.length }) : null, days.some((d) => d.immature) ? t("immatureNote") : null].filter(Boolean);
  const note = notes.length ? notes.join(" ") : undefined;
  return (
    <>
      <LineChart title={t("ordersPerDay")} xs={xs} series={orders} empty={empty} note={note} />
      <LineChart title={t("rates")} xs={xs} series={rates} empty={empty} note={note} axis="percent" />
    </>
  );
}

const OUTCOME_COLORS: Record<string, string> = {
  delivered: "var(--success)",
  returned: "var(--danger)",
  cancelled: "var(--neutral)",
  unconfirmed: "var(--warning)",
  in_progress: "var(--info)",
};
const OUTCOME_ORDER = ["delivered", "returned", "cancelled", "unconfirmed", "in_progress"];
async function OutcomeChart({ scope }: { scope: Scope }) {
  const t = await getTranslations("statistics.charts");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("kpi_outcomes", rpcArgs(scope));
  if (error) {
    console.error("statistics/kpi_outcomes", error.message);
    return <ChartLoadError title={t("outcomes")} />;
  }
  const raw = (data ?? [])
    .map((r) => ({ key: r.outcome, label: t(`outcome.${r.outcome}`), value: r.n }))
    .sort((a, b) => OUTCOME_ORDER.indexOf(a.key) - OUTCOME_ORDER.indexOf(b.key));
  const total = raw.reduce((s, x) => s + x.value, 0);
  const slices = collapseSlices(raw, 5, t("other")).map((s) => ({
    ...s,
    display: formatInt(s.value),
    color: OUTCOME_COLORS[s.key] ?? "var(--neutral)",
    href: ordersQs(scope.filters, { drill: `out_${s.key}` }),
  }));
  return (
    <DonutChart
      title={t("outcomes")}
      slices={slices}
      totalLabel={t("received")}
      totalDisplay={formatInt(total)}
      head={[t("outcomes"), t("received"), t("share")]}
      empty={total === 0 ? emptyOrders(t("emptyOutcomes"), t("allOrders")) : null}
    />
  );
}

type ComparisonRow = { id: string; name: string; delivery: KpiMetric };

export function DeliveryComparison({ title, dimension, rows }: {
  title: string;
  dimension: "product" | "wilaya";
  rows: ComparisonRow[];
}) {
  const t = useTranslations();
  const sorted = [...rows].sort((a, b) =>
    (a.delivery.value ?? Infinity) - (b.delivery.value ?? Infinity) || a.name.localeCompare(b.name),
  );
  return (
    <ChartPanel
      title={title}
      empty={rows.length ? null : emptyOrders(t("statistics.emptyTitle"), t("statistics.charts.allOrders"))}
      plot={
        <table className={`${tableClass} [&_td]:px-2 [&_th]:px-2`}>
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr>
              <th scope="col" className="text-start">{t(`fields.${dimension}`)}</th>
              <th scope="col" className="text-end">{t("statistics.charts.outcome.delivered")}</th>
              <th scope="col" className="text-end">{t("statistics.charts.shipped")}</th>
              <th scope="col" className="text-end">{t("statistics.charts.delivery")}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ id, name, delivery }) => {
              const pct = kpiPct(delivery);
              return (
                <tr key={id}>
                  <th scope="row" className="break-words text-start font-medium"><bdi>{name}</bdi></th>
                  <td className="num text-end">{formatInt(delivery.num)}</td>
                  <td className="num text-end">{formatInt(delivery.den)}</td>
                  <td className="text-end">
                    <div className="flex items-center justify-end gap-2">
                      {pct === null ? null : <RateBar pct={pct} matured={delivery.matured} className="hidden xl:block" />}
                      <span className="num">{formatPercent(pct)}</span>
                    </div>
                    {delivery.matured ? null : (
                      <span className="block text-xs text-muted-foreground">{t("statistics.notEnoughData")}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      }
    />
  );
}

async function ProductChart({ scope }: { scope: Scope }) {
  const t = await getTranslations("statistics.charts");
  const title = scope.wilayaName ? t("productsInWilaya", { name: scope.wilayaName }) : t("byProduct");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("kpi_by_product", rpcArgs(scope));
  if (error) {
    console.error("statistics/kpi_by_product", error.message);
    return <ChartLoadError title={title} />;
  }
  const rows = (data ?? []).flatMap((r) => {
    const rates = r.rates as unknown as KpiGroupRates | null;
    return rates?.counts && r.product_id ? [{ id: r.product_id, name: r.product_name ?? "—", rates }] : [];
  });
  if (scope.wilayaName) {
    return <DeliveryComparison title={title} dimension="product" rows={rows.map((r) => ({ ...r, delivery: r.rates.delivery }))} />;
  }
  const items: BarItem[] = worstFirst(rows, (r) => r.rates.counts.received, (r) => kpiPct(r.rates.delivery), MIN_ORDERS, TOP).map((r) => ({
    key: r.id,
    label: r.name,
    value: kpiPct(r.rates.delivery) ?? 0,
    display: formatPercent(kpiPct(r.rates.delivery)),
    sub: t("ordersCount", { n: formatInt(r.rates.counts.received) }),
    href: ordersQs(scope.filters, { product_id: r.id, drill: "received" }),
    color: r.rates.delivery.matured ? undefined : "var(--neutral)",
  }));
  return (
    <BarChart
      title={title}
      items={items}
      orientation="h"
      valueHead={t("delivery")}
      subHead={t("received")}
      note={t("floorNote", { n: MIN_ORDERS })}
      empty={items.length ? null : emptyOrders(t("emptyFloor", { n: MIN_ORDERS }), t("allOrders"))}
    />
  );
}

/** Delivery rate per wilaya, worst first, from the rows the page already loaded (kpi_by_wilaya). */
export function WilayaChart({ rows, filters, productName }: { rows: StatsRow[]; filters: DashboardFilters; productName?: string }) {
  const t = useTranslations("statistics.charts");
  if (productName) {
    return (
      <DeliveryComparison
        title={t("wilayasForProduct", { name: productName })}
        dimension="wilaya"
        rows={rows.flatMap((r) => r.code === null ? [] : [{ id: String(r.code), name: r.name ?? String(r.code), delivery: r.group.rates.delivery }])}
      />
    );
  }
  const items: BarItem[] = worstFirst(
    rows.filter((r) => r.code !== null),
    (r) => r.group.rates.counts.received,
    (r) => kpiPct(r.group.rates.delivery),
    MIN_ORDERS,
    TOP,
  ).map((r) => ({
    key: String(r.code),
    label: r.name ?? String(r.code),
    value: kpiPct(r.group.rates.delivery) ?? 0,
    display: formatPercent(kpiPct(r.group.rates.delivery)),
    sub: t("ordersCount", { n: formatInt(r.group.rates.counts.received) }),
    href: drillHref(filters, "received", { wilaya: r.code as number }),
    color: r.group.rates.delivery.matured ? undefined : "var(--neutral)",
  }));
  return (
    <BarChart
      title={t("byWilaya")}
      items={items}
      orientation="h"
      valueHead={t("delivery")}
      subHead={t("received")}
      note={t("floorNote", { n: MIN_ORDERS })}
      empty={items.length ? null : emptyOrders(t("emptyFloor", { n: MIN_ORDERS }), t("allOrders"))}
    />
  );
}

async function WhenCharts({ scope }: { scope: Scope }) {
  const t = await getTranslations("statistics.charts");
  const locale = await getLocale();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("kpi_by_weekday_hour", rpcArgs(scope));
  if (error) {
    console.error("statistics/kpi_by_weekday_hour", error.message);
    return (
      <>
        <ChartLoadError title={t("byWeekday")} />
        <ChartLoadError title={t("byHour")} />
      </>
    );
  }
  const count = (kind: string, bucket: number) => {
    const r = (data ?? []).find((x) => x.kind === kind && x.bucket === bucket);
    return (r?.rates as unknown as KpiGroupRates | undefined)?.counts.received ?? 0;
  };
  // ISO weekdays: the week starts on Saturday in Arabic and on Monday in English (locale choice)
  const order = locale === "ar" ? [6, 7, 1, 2, 3, 4, 5] : [1, 2, 3, 4, 5, 6, 7];
  const weekdays: BarItem[] = order.map((d) => ({ key: `w${d}`, label: t(`weekday.${d}`), short: t(`weekdayShort.${d}`), value: count("weekday", d), display: formatInt(count("weekday", d)), href: ordersQs(scope.filters, { drill: "received", weekday: String(d) }) }));
  const hours: BarItem[] = Array.from({ length: 24 }, (_, h) => ({ key: `h${h}`, label: `${String(h).padStart(2, "0")}:00`, short: String(h).padStart(2, "0"), value: count("hour", h), display: formatInt(count("hour", h)), href: ordersQs(scope.filters, { drill: "received", hour: String(h) }) }));
  const total = weekdays.reduce((s, x) => s + x.value, 0);
  const empty = total === 0 ? emptyOrders(t("emptyOutcomes"), t("allOrders")) : null;
  return (
    <>
      <BarChart title={t("byWeekday")} items={weekdays} valueHead={t("received")} empty={empty} />
      <BarChart title={t("byHour")} items={hours} valueHead={t("received")} empty={empty} note={t("hourNote")} />
    </>
  );
}

/** Statistics charts. Each chart streams in its own Suspense with a skeleton at its real height. */
export async function StatsCharts({ scope, where, wilayaChart }: { scope: Scope; where: React.ReactNode; wilayaChart: React.ReactNode }) {
  const t = await getTranslations("statistics.sections");
  return (
    <>
      <StatSection id="stats-volume" title={t("volume")}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Suspense fallback={fallback(300)}>
            <DailyCharts scope={scope} />
          </Suspense>
        </div>
      </StatSection>
      <StatSection id="stats-outcomes" title={t("outcomes")}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Suspense fallback={fallback(300)}>
            <OutcomeChart scope={scope} />
          </Suspense>
        </div>
      </StatSection>
      <StatSection id="stats-where" title={t("where")}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {wilayaChart}
          <Suspense fallback={fallback(300)}>
            <ProductChart scope={scope} />
          </Suspense>
        </div>
        {where}
      </StatSection>
      <StatSection id="stats-when" title={t("when")}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Suspense fallback={fallback(300)}>
            <WhenCharts scope={scope} />
          </Suspense>
        </div>
      </StatSection>
    </>
  );
}
