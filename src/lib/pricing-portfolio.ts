// Portfolio view (PRICE-4): one row per product, all three scenarios computed by the
// pricing-v2 engine. Pure: no formula lives here, only selection and summing (D68).
import type { CsvColumn } from "@/lib/csv";
import {
  computeAll,
  resolveSettings,
  scenarioInputs,
  type DeepPartial,
  type PricingSettings,
  type ScenarioName,
  type ScenarioResult,
} from "@/lib/pricing-v2";
import { saleBelowBreakEven, stockCostTotal } from "@/lib/pricing-form";

type N = number | null;

export const SCENARIOS: readonly ScenarioName[] = ["best", "medium", "worst"];

export type PortfolioProduct = {
  id: string;
  /** Archived products (false) are left out of the portfolio and its totals. */
  isActive?: boolean;
  name: string;
  salePrice: N;
  stock: number;
  perPieceCost: N; // product_costs.sourcing_cost_dzd
  pricing: {
    overrides?: DeepPartial<PricingSettings> | null;
    adBest: N;
    adMedium: N;
    adWorst: N;
    finalPrice: N;
  } | null;
};

export type PortfolioRow = {
  id: string;
  name: string;
  stock: number;
  salePrice: N;
  stockCost: N;
  /** null when there is no cost or no stock: nothing to calculate. */
  results: Record<ScenarioName, ScenarioResult> | null;
  adCostUsd: Record<ScenarioName, N>;
};

export function portfolioRow(workspaceDefaults: DeepPartial<PricingSettings> | null | undefined, p: PortfolioProduct): PortfolioRow {
  const stockCost = stockCostTotal(p.perPieceCost, p.stock);
  const ad = {
    best: p.pricing?.adBest ?? null,
    medium: p.pricing?.adMedium ?? null,
    worst: p.pricing?.adWorst ?? null,
  };
  const overrides = p.pricing?.overrides ?? null;
  const inputs = scenarioInputs(resolveSettings(workspaceDefaults, overrides), ad);
  const adCostUsd = { best: inputs.best.adCostUsd, medium: inputs.medium.adCostUsd, worst: inputs.worst.adCostUsd };
  const results =
    stockCost === null
      ? null
      : computeAll(workspaceDefaults, {
          stockCostDzd: stockCost,
          quantity: p.stock,
          adCostUsd: ad,
          finalPrice: p.pricing?.finalPrice ?? null,
          overrides,
        });
  return { id: p.id, name: p.name, stock: p.stock, salePrice: p.salePrice, stockCost, results, adCostUsd };
}

export const portfolioRows = (
  workspaceDefaults: DeepPartial<PricingSettings> | null | undefined,
  products: readonly PortfolioProduct[],
): PortfolioRow[] => products.filter((p) => p.isActive !== false).map((p) => portfolioRow(workspaceDefaults, p));

/** D68: stock cost + total ad spend (DZD); excludes per-order lines, fees and delivery. */
export function capitalNeeded(stockCostTotalDzd: N, totalAdDzd: N): N {
  return stockCostTotalDzd === null || totalAdDzd === null ? null : stockCostTotalDzd + totalAdDzd;
}

/** A row counts in the totals only when its scenario computes a net profit. */
export const isIncluded = (row: PortfolioRow, s: ScenarioName): boolean => row.results?.[s].netProfit != null;

export type PortfolioTotals = {
  included: number;
  excluded: number;
  stockCost: number;
  totalAdUsd: number;
  totalAdDzd: number;
  netProfit: number;
  revenue: number;
  capital: N;
  /** net profit / revenue; null when there is no revenue. */
  margin: N;
};

export function portfolioTotals(rows: readonly PortfolioRow[], s: ScenarioName): PortfolioTotals {
  const t = { included: 0, excluded: 0, stockCost: 0, totalAdUsd: 0, totalAdDzd: 0, netProfit: 0, revenue: 0 };
  for (const row of rows) {
    const r = row.results?.[s];
    if (!r || r.netProfit === null) {
      t.excluded += 1;
      continue;
    }
    t.included += 1;
    t.stockCost += row.stockCost ?? 0;
    t.totalAdUsd += r.totalAdUsd ?? 0;
    t.totalAdDzd += r.totalAdDzd ?? 0;
    t.netProfit += r.netProfit;
    t.revenue += (r.finalPrice ?? 0) * (r.sellable ?? 0);
  }
  const any = t.included > 0;
  return {
    ...t,
    capital: any ? capitalNeeded(t.stockCost, t.totalAdDzd) : null,
    margin: any && t.revenue > 0 ? t.netProfit / t.revenue : null,
  };
}

export type PortfolioColumnKey =
  | "name"
  | "stock"
  | "stockCost"
  | "adCostUsd"
  | "recommendedPrice"
  | "salePrice"
  | "profitPerPiece"
  | "netProfit"
  | "margin"
  | "totalAdUsd"
  | "totalAdDzd"
  | "capital"
  | "minPrice";

export const PORTFOLIO_COLUMNS: readonly PortfolioColumnKey[] = [
  "name",
  "stock",
  "stockCost",
  "adCostUsd",
  "recommendedPrice",
  "salePrice",
  "profitPerPiece",
  "netProfit",
  "margin",
  "totalAdUsd",
  "totalAdDzd",
  "capital",
  "minPrice",
];

/** One cell for the table and the CSV. Numbers stay raw; null = "—". */
export function portfolioCell(row: PortfolioRow, s: ScenarioName, key: PortfolioColumnKey): string | number | null {
  const r = row.results?.[s];
  switch (key) {
    case "name":
      return row.name;
    case "stock":
      return row.stock;
    case "stockCost":
      return row.stockCost;
    case "adCostUsd":
      return row.adCostUsd[s];
    case "salePrice":
      return row.salePrice;
    case "recommendedPrice":
      return r?.recommendedPrice ?? null;
    case "profitPerPiece":
      return r?.profitPerPiece ?? null;
    case "netProfit":
      return r?.netProfit ?? null;
    case "margin":
      return r?.margin ?? null;
    case "totalAdUsd":
      return r?.totalAdUsd ?? null;
    case "totalAdDzd":
      return r?.totalAdDzd ?? null;
    case "capital":
      return r && isIncluded(row, s) ? capitalNeeded(row.stockCost, r.totalAdDzd) : null;
    case "minPrice":
      return r?.breakEven.minSellingPrice ?? null;
  }
}

/** Below-break-even badge: the store price against the MEDIUM break-even, as on the product Pricing tab. */
export const rowBelowBreakEven = (row: PortfolioRow): boolean =>
  saleBelowBreakEven(row.salePrice, row.results?.medium.breakEven.minSellingPrice ?? null);

export function portfolioCsvColumns(s: ScenarioName, labels: Record<PortfolioColumnKey, string>): CsvColumn<PortfolioRow>[] {
  return PORTFOLIO_COLUMNS.map((key) => ({ key, label: labels[key], value: (row) => portfolioCell(row, s, key) }));
}
