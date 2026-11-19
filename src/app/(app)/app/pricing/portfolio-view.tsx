"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AlertTriangle, Download } from "lucide-react";

import { ButtonLink } from "@/components/button-link";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { downloadCSV, toCSV } from "@/lib/csv";
import { formatCurrency, formatInt, formatPercent, formatUsd } from "@/lib/format";
import {
  PORTFOLIO_COLUMNS,
  portfolioCell,
  portfolioCsvColumns,
  portfolioTotals,
  rowBelowBreakEven,
  SCENARIOS,
  type PortfolioColumnKey,
  type PortfolioRow,
} from "@/lib/pricing-portfolio";
import type { ScenarioName } from "@/lib/pricing-v2";
import { cn } from "@/lib/utils";

const MARGIN = (m: number | null) => (m === null ? null : Math.round(m * 1000) / 10);

export function PortfolioView({ rows }: { rows: PortfolioRow[] }) {
  const t = useTranslations("pricingPortfolio");
  const dzd = t("dzd");
  const [scenario, setScenario] = React.useState<ScenarioName>("medium");
  const totals = React.useMemo(() => portfolioTotals(rows, scenario), [rows, scenario]);

  if (rows.length === 0) {
    return (
      <div className="card-surface rounded-xl p-10 text-center">
        <p className="text-sm font-medium text-foreground">{t("emptyTitle")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("emptyBody")}</p>
        <div className="mt-4 flex justify-center">
          <ButtonLink href="/app/products/new" size="sm">
            {t("emptyAction")}
          </ButtonLink>
        </div>
      </div>
    );
  }

  const money = (v: number | string | null) => (typeof v === "number" ? formatCurrency(v, dzd) : "—");
  const fmt: Record<PortfolioColumnKey, (v: string | number | null) => string> = {
    name: (v) => String(v ?? ""),
    stock: (v) => (typeof v === "number" ? formatInt(v) : "—"),
    stockCost: money,
    adCostUsd: (v) => (typeof v === "number" ? formatUsd(v, { decimals: 2 }) : "—"),
    recommendedPrice: money,
    salePrice: money,
    profitPerPiece: money,
    netProfit: money,
    margin: (v) => (typeof v === "number" ? formatPercent(MARGIN(v)) : "—"),
    totalAdUsd: (v) => (typeof v === "number" ? formatUsd(v) : "—"),
    totalAdDzd: money,
    minPrice: (v) => (typeof v === "number" ? formatCurrency(Math.ceil(v), dzd) : "—"),
  };

  const labels = Object.fromEntries(PORTFOLIO_COLUMNS.map((k) => [k, t(`columns.${k}`)])) as Record<PortfolioColumnKey, string>;
  function exportCsv() {
    downloadCSV(`pricing-${scenario}.csv`, toCSV(portfolioCsvColumns(scenario, labels), rows));
  }

  const cards: { key: string; value: string; hint?: string; tone?: "danger" }[] = [
    { key: "stockCost", value: totals.included ? formatCurrency(totals.stockCost, dzd) : "—" },
    {
      key: "adSpend",
      value: totals.included ? formatUsd(totals.totalAdUsd) : "—",
      hint: totals.included ? formatCurrency(totals.totalAdDzd, dzd) : undefined,
    },
    { key: "netProfit", value: totals.included ? formatCurrency(totals.netProfit, dzd) : "—", tone: totals.netProfit < 0 ? "danger" : undefined },
    { key: "capital", value: formatCurrency(totals.capital, dzd), hint: t("capitalHint") },
    { key: "margin", value: formatPercent(MARGIN(totals.margin)) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label={t("scenario.label")} className="inline-flex gap-1 rounded-lg border border-border p-1">
          {SCENARIOS.map((s) => (
            <Button
              key={s}
              type="button"
              size="sm"
              variant={scenario === s ? "default" : "ghost"}
              aria-pressed={scenario === s}
              onClick={() => setScenario(s)}
            >
              {t(`scenario.${s}`)}
            </Button>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={exportCsv}>
          <Download />
          {t("export")}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.key} className="card-surface min-w-0 rounded-xl p-4">
            <p className="text-xs text-muted-foreground">{t(`cards.${c.key}`)}</p>
            <p className={cn("num mt-1 truncate text-lg font-semibold", c.tone === "danger" && "text-danger")}>{c.value}</p>
            {c.hint ? <p className="num truncate text-xs text-muted-foreground">{c.hint}</p> : null}
          </div>
        ))}
      </div>
      {totals.excluded > 0 ? <p className="text-sm text-muted-foreground">{t("notIncluded", { count: totals.excluded })}</p> : null}

      <div className="card-surface overflow-x-auto rounded-xl">
        <table className="w-full min-w-max text-sm">
          <caption className="sr-only">{t("table")}</caption>
          <thead className="bg-surface text-xs text-muted-foreground">
            <tr>
              {PORTFOLIO_COLUMNS.map((k) => (
                <th
                  key={k}
                  scope="col"
                  className={cn(
                    "whitespace-nowrap px-3 py-2 font-medium",
                    k === "name" ? "sticky start-0 z-10 bg-surface text-start" : "text-end",
                  )}
                >
                  {labels[k]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const incomplete = row.results === null || row.results[scenario].netProfit === null;
              const below = rowBelowBreakEven(row, scenario);
              return (
                <tr key={row.id} className="border-t border-border hover:bg-accent/40">
                  {PORTFOLIO_COLUMNS.map((k) => {
                    const v = portfolioCell(row, scenario, k);
                    if (k === "name")
                      return (
                        <th key={k} scope="row" className="sticky start-0 z-10 max-w-56 bg-surface px-3 py-2 text-start font-medium">
                          <Link href={`/app/products/${row.id}/pricing`} className="block truncate hover:underline">
                            {row.name}
                          </Link>
                          {incomplete ? <span className="block text-xs font-normal text-muted-foreground">{t("missing")}</span> : null}
                        </th>
                      );
                    return (
                      <td key={k} className="num whitespace-nowrap px-3 py-2 text-end">
                        {fmt[k](v)}
                        {k === "salePrice" && below ? (
                          <Chip token="danger" size="sm" className="ms-2" icon={<AlertTriangle className="h-3.5 w-3.5" aria-hidden />}>
                            {t("belowBreakEven")}
                          </Chip>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-surface font-semibold">
              <th scope="row" className="sticky start-0 z-10 bg-surface px-3 py-2 text-start">
                {t("totals")}
              </th>
              {PORTFOLIO_COLUMNS.slice(1).map((k) => (
                <td key={k} className="num whitespace-nowrap px-3 py-2 text-end">
                  {k === "stockCost" && totals.included ? formatCurrency(totals.stockCost, dzd) : null}
                  {k === "netProfit" && totals.included ? formatCurrency(totals.netProfit, dzd) : null}
                  {k === "margin" ? (totals.margin === null ? null : formatPercent(MARGIN(totals.margin))) : null}
                  {k === "totalAdUsd" && totals.included ? formatUsd(totals.totalAdUsd) : null}
                  {k === "totalAdDzd" && totals.included ? formatCurrency(totals.totalAdDzd, dzd) : null}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
