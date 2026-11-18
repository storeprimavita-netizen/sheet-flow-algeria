"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, Minus, TrendingDown, TrendingUp } from "lucide-react";

import { Chip } from "@/components/ui/chip";
import { PricingCell, type PricingCellState } from "@/components/pricing/pricing-cell";
import { formatCurrency, formatInt, formatPercent, formatUsd, ltr } from "@/lib/format";
import { breakEvenState, type BreakEvenKey } from "@/lib/pricing-form";
import type { ScenarioName, ScenarioResult } from "@/lib/pricing-v2";

const SCENARIOS: readonly ScenarioName[] = ["best", "medium", "worst"];
const SCENARIO_UI = {
  best: { token: "success", Icon: TrendingUp },
  medium: { token: "warning", Icon: Minus },
  worst: { token: "danger", Icon: TrendingDown },
} as const;

type Fmt = "da" | "usd" | "pct" | "int";
type Row = { key: string; get: (r: ScenarioResult) => number | null; fmt: Fmt; breakEven?: BreakEvenKey };
const GROUPS: { id: string; rows: Row[] }[] = [
  {
    id: "groupAds",
    rows: [
      { key: "totalAdUsd", get: (r) => r.totalAdUsd, fmt: "usd" },
      { key: "totalAdDzd", get: (r) => r.totalAdDzd, fmt: "da" },
      { key: "ordersNeeded", get: (r) => r.ordersNeeded, fmt: "int" },
    ],
  },
  { id: "groupCost", rows: [{ key: "totalCost", get: (r) => r.totalCost, fmt: "da" }] },
  {
    id: "groupPrice",
    rows: [
      { key: "recommendedPrice", get: (r) => r.recommendedPrice, fmt: "da" },
      { key: "finalPrice", get: (r) => r.finalPrice, fmt: "da" },
    ],
  },
  {
    id: "groupProfit",
    rows: [
      { key: "profitPerPiece", get: (r) => r.profitPerPiece, fmt: "da" },
      { key: "netProfit", get: (r) => r.netProfit, fmt: "da" },
      { key: "margin", get: (r) => (r.margin === null ? null : r.margin * 100), fmt: "pct" },
    ],
  },
  {
    id: "groupBreakEven",
    rows: [
      { key: "minConfirmation", get: (r) => r.breakEven.minConfirmation === null ? null : r.breakEven.minConfirmation * 100, fmt: "pct", breakEven: "minConfirmation" },
      { key: "minDelivery", get: (r) => r.breakEven.minDelivery === null ? null : r.breakEven.minDelivery * 100, fmt: "pct", breakEven: "minDelivery" },
      { key: "maxAdCostUsd", get: (r) => r.breakEven.maxAdCostUsd, fmt: "usd", breakEven: "maxAdCostUsd" },
      { key: "minSellingPrice", get: (r) => r.breakEven.minSellingPrice, fmt: "da", breakEven: "minSellingPrice" },
    ],
  },
];

function format(v: number, fmt: Fmt, unit: string): string {
  switch (fmt) {
    case "da":
      return formatCurrency(v, unit);
    case "usd":
      return formatUsd(v, { decimals: 2 });
    case "pct":
      return formatPercent(Math.round(v * 10) / 10);
    case "int":
      return formatInt(Math.ceil(v));
  }
}

export function PricingResults({ results, unit }: { results: Record<ScenarioName, ScenarioResult>; unit: string }) {
  const t = useTranslations("pricingV2");
  const losing = SCENARIOS.filter((s) => (results[s].profitPerPiece ?? 0) < 0);
  const anyImpossible = SCENARIOS.some((s) =>
    (["minConfirmation", "minDelivery", "maxAdCostUsd"] as const).some((k) => breakEvenState(results[s], k) === "impossible"),
  );

  return (
    <div className="space-y-2">
      <div
        className="card-surface overflow-x-auto rounded-xl focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        tabIndex={0}
        role="region"
        aria-label={t("product.table")}
      >
        <table className="w-full min-w-[34rem] border-separate border-spacing-0 text-sm">
          <caption className="sr-only">{t("product.table")}</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky start-0 z-10 bg-card px-3 py-2 text-start font-medium text-muted-foreground">
                <span className="sr-only">{t("product.table")}</span>
              </th>
              {SCENARIOS.map((s) => {
                const { token, Icon } = SCENARIO_UI[s];
                return (
                  <th key={s} scope="col" className="px-3 py-2 text-end font-medium">
                    <Chip token={token} size="sm" icon={<Icon className="h-3.5 w-3.5" aria-hidden />}>
                      {t(`scenario.${s}`)}
                    </Chip>
                  </th>
                );
              })}
            </tr>
          </thead>
          {GROUPS.map((g) => (
            <tbody key={g.id}>
              <tr>
                <th
                  scope="colgroup"
                  colSpan={4}
                  className="sticky start-0 border-t border-border bg-surface-raised px-3 py-1.5 text-start text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                >
                  {t(`rows.${g.id}`)}
                </th>
              </tr>
              {g.rows.map((row) => (
                <tr key={row.key}>
                  <th scope="row" className="sticky start-0 z-10 bg-card px-3 py-2 text-start font-normal text-muted-foreground">
                    {t(`rows.${row.key}`)}
                  </th>
                  {SCENARIOS.map((s) => {
                    const r = results[s];
                    const v = row.get(r);
                    const state: PricingCellState = row.breakEven ? breakEvenState(r, row.breakEven) : v === null ? "missing" : "value";
                    return (
                      <td key={s} className="px-3 py-2 text-end">
                        <PricingCell state={state} missingLabel={t("missing")} impossibleLabel={t("notPossible")}>
                          {v === null ? null : format(v, row.fmt, unit)}
                        </PricingCell>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
      {losing.length ? (
        <p className="flex items-start gap-1.5 text-xs text-danger" role="status">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {t("product.belowBreakEven", { scenarios: losing.map((s) => t(`scenario.${s}`)).join(", ") })}
        </p>
      ) : null}
      {anyImpossible ? <p className="text-xs text-muted-foreground">{t("notPossibleHint")}</p> : null}
    </div>
  );
}
