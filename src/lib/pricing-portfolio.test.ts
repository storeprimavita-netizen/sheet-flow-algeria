import { describe, expect, it } from "vitest";

import { toCSV } from "@/lib/csv";
import {
  capitalNeeded,
  portfolioCsvColumns,
  portfolioRow,
  portfolioTotals,
  PORTFOLIO_COLUMNS,
  portfolioCell,
  portfolioRows,
  rowBelowBreakEven,
  type PortfolioProduct,
} from "@/lib/pricing-portfolio";

const benz = (over: Partial<PortfolioProduct> = {}): PortfolioProduct => ({
  id: "p1",
  name: "BENZ",
  salePrice: 5500,
  stock: 50,
  perPieceCost: 1632, // 81,600 DZD / 50 pcs
  pricing: { adBest: null, adMedium: 2.2, adWorst: 2.7, finalPrice: 4500 },
  ...over,
});
const row = (p: PortfolioProduct = benz()) => portfolioRow(null, p);

describe("portfolio", () => {
  it("benz capital needed 107,199 / 141,351 / 173,700 (best/medium/worst)", () => {
    const r = [row()];
    const cap = (["best", "medium", "worst"] as const).map((s) => Math.round(portfolioTotals(r, s).capital ?? 0));
    expect(cap).toEqual([107199, 141351, 173700]);
  });

  it("capital card = stock card + ad-spend DZD card", () => {
    const t = portfolioTotals([row()], "medium");
    expect(t.capital).toBeCloseTo(t.stockCost + t.totalAdDzd, 6);
    expect(capitalNeeded(1, null)).toBeNull();
    expect(capitalNeeded(null, 1)).toBeNull();
  });

  it("benz row reproduces MEDIUM 3,885 cost / 5,500 price / 23,745 net at final 4,500", () => {
    const m = row().results!.medium;
    expect(Math.round(m.totalCost!)).toBe(3885);
    expect(m.recommendedPrice).toBe(5500);
    expect(Math.round(m.netProfit!)).toBe(23745);
    expect(m.finalPrice).toBe(4500);
  });

  it("best and worst totals differ from medium and are all computed", () => {
    const r = [row()];
    const net = (["best", "medium", "worst"] as const).map((s) => portfolioTotals(r, s).netProfit);
    expect(new Set(net).size).toBe(3);
    expect(net[0]).toBeGreaterThan(net[2]);
  });

  it("two-product totals equal the sums of the rows", () => {
    const a = row();
    const b = row(benz({ id: "p2", name: "B", stock: 100, perPieceCost: 1000 }));
    const t = portfolioTotals([a, b], "medium");
    const ta = portfolioTotals([a], "medium");
    const tb = portfolioTotals([b], "medium");
    expect(t.netProfit).toBeCloseTo(ta.netProfit + tb.netProfit, 6);
    expect(t.stockCost).toBeCloseTo(ta.stockCost + tb.stockCost, 6);
    expect(t.totalAdDzd).toBeCloseTo(ta.totalAdDzd + tb.totalAdDzd, 6);
    expect(t.included).toBe(2);
  });

  it("rows missing cost, stock or ad cost show nothing, are excluded from every sum and counted", () => {
    const good = row();
    const noCost = row(benz({ id: "x", perPieceCost: null }));
    const noStock = row(benz({ id: "y", stock: 0 }));
    const noAd = row(benz({ id: "z", pricing: null }));
    expect(noCost.results).toBeNull();
    expect(noStock.results).toBeNull();
    expect(noAd.results!.medium.netProfit).toBeNull();
    const t = portfolioTotals([good, noCost, noStock, noAd], "medium");
    const only = portfolioTotals([good], "medium");
    expect(t).toEqual({ ...only, excluded: 3 });
    expect(t.included).toBe(1);
  });

  it("no revenue gives a null margin, never NaN", () => {
    expect(portfolioTotals([], "medium").margin).toBeNull();
    const r0 = row();
    const zero = { ...r0, results: { ...r0.results!, medium: { ...r0.results!.medium, sellable: 0 } } };
    const t = portfolioTotals([zero], "medium");
    expect(t.included).toBe(1);
    expect(t.revenue).toBe(0);
    expect(t.margin).toBeNull();
  });

  it("capital cell is null for a row left out of the totals", () => {
    const r = row();
    const out = { ...r, results: { ...r.results!, medium: { ...r.results!.medium, netProfit: null } } };
    expect(portfolioCell(out, "medium", "capital")).toBeNull();
  });

  it("inactive products are left out of the rows and totals", () => {
    const rows = portfolioRows(null, [benz(), benz({ id: "gone", isActive: false })]);
    expect(rows.map((r) => r.id)).toEqual(["p1"]);
    expect(portfolioTotals(rows, "medium")).toEqual(portfolioTotals([row()], "medium"));
  });

  it("row capital = row stock cost + row ad DZD, and its column total equals the card", () => {
    const rows = [row(), row(benz({ id: "p2", stock: 100, perPieceCost: 1000 }))];
    for (const r of rows) {
      expect(portfolioCell(r, "medium", "capital")).toBeCloseTo(r.stockCost! + r.results!.medium.totalAdDzd!, 6);
    }
    const sum = rows.reduce((a, r) => a + (portfolioCell(r, "medium", "capital") as number), 0);
    expect(sum).toBeCloseTo(portfolioTotals(rows, "medium").capital!, 6);
    expect(portfolioCell(row(benz({ perPieceCost: null })), "medium", "capital")).toBeNull();
  });

  it("worst-case capital with only the medium ad set uses the derived 2.71 (174,041), not the typed 2.70", () => {
    const r = row(benz({ pricing: { adBest: null, adMedium: 2.2, adWorst: null, finalPrice: 4500 } }));
    expect(Math.round(portfolioTotals([r], "worst").capital ?? 0)).toBe(174041);
  });

  it("a product with ad cost 0 is included with capital equal to its stock cost", () => {
    const r = row(benz({ pricing: { adBest: 0, adMedium: 0, adWorst: 0, finalPrice: 4500 } }));
    const t = portfolioTotals([r], "medium");
    expect(t.included).toBe(1);
    expect(t.capital).toBe(81600);
  });

  it("stock-only, cost-only and no-ad-cost rows are each excluded", () => {
    const rows = [
      row(benz({ id: "a", perPieceCost: null, stock: 10 })),
      row(benz({ id: "b", stock: 0 })),
      row(benz({ id: "c", pricing: null })),
    ];
    const t = portfolioTotals(rows, "medium");
    expect([t.included, t.excluded, t.capital]).toEqual([0, 3, null]);
  });

  it("badge uses the medium break-even in every scenario; null sale price never flags", () => {
    expect(rowBelowBreakEven(row(benz({ salePrice: null })))).toBe(false);
    expect(rowBelowBreakEven(row(benz({ salePrice: 1 })))).toBe(true);
    expect(rowBelowBreakEven(row(benz({ salePrice: 100000 })))).toBe(false);
  });

  it("a per-product override changes only that row", () => {
    const base = row();
    const over = row(benz({ id: "o", pricing: { ...benz().pricing!, overrides: { packaging: 500 } } }));
    expect(over.results!.medium.totalCost).not.toBe(base.results!.medium.totalCost);
    expect(row().results!.medium.totalCost).toBe(base.results!.medium.totalCost);
  });

  it("CSV has the columns, raw numbers, and escapes a comma and Arabic name", () => {
    const labels = Object.fromEntries(PORTFOLIO_COLUMNS.map((k) => [k, k])) as Record<(typeof PORTFOLIO_COLUMNS)[number], string>;
    const csv = toCSV(portfolioCsvColumns("medium", labels), [row(benz({ name: 'حذاء, "رياضي"' })), row(benz({ id: "n", perPieceCost: null }))]);
    const [head, a, b] = csv.split("\r\n");
    expect(head).toBe(PORTFOLIO_COLUMNS.join(","));
    expect(a.startsWith('"حذاء, ""رياضي""",50,81600,2.2,5500,5500,')).toBe(true);
    expect(b).toBe("BENZ,50,,2.2,,5500,,,,,,,");
  });
});
