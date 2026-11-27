import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

/** P1-2 guard: the dashboard shows SQL figures (kpi_lines) and never re-derives a formula. */
const files = [
  path.resolve(__dirname, "page.tsx"),
  ...readdirSync(path.resolve(__dirname, "../../../../components/dashboard"))
    .filter((f) => /^(band|needs-action-band|money-band|money-chart|order-journey|stock-strip|product-scorecard|usd-first)\.tsx$/.test(f))
    .map((f) => path.resolve(__dirname, "../../../../components/dashboard", f)),
  // CHART-1: the shared chart components are drawing code, no formula either
  ...readdirSync(path.resolve(__dirname, "../../../../components/charts"))
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f))
    .map((f) => path.resolve(__dirname, "../../../../components/charts", f)),
];

describe("dashboard reads SQL figures only", () => {
  for (const f of files) {
    test(path.basename(f), () => {
      const src = readFileSync(f, "utf8");
      expect(src).not.toMatch(/from "@\/lib\/pricing/);
      expect(src).not.toMatch(/pnlMetrics|asPnl|computeScenario/);
    });
  }
  test("page reads kpi from dashboard_stats", () => {
    expect(readFileSync(files[0], "utf8")).toContain('rpc("dashboard_stats"');
  });

  const comp = (n: string) => readFileSync(path.resolve(__dirname, "../../../../components/dashboard", n), "utf8");
  test("bands render the fields the spec lists", () => {
    const stock = comp("stock-strip.tsx");
    for (const k of ["inStock", "reserved", "onRoad", "delivered", "lowItems"]) expect(stock).toContain(`"${k}"`);
    expect(comp("product-scorecard.tsx")).toContain('t("stock")');
  });
  test("to-retry link carries the same statuses as its count", () => {
    expect(comp("needs-action-band.tsx")).toContain("RETRY_CONFIRMATION.join");
    expect(readFileSync(path.resolve(__dirname, "page.tsx"), "utf8")).toContain("RETRY_CONFIRMATION");
  });
  test("empty period shows no false signals", () => {
    expect(comp("money-band.tsx")).toContain("if (before === 0) return null");
    expect(comp("money-band.tsx")).toContain("Math.abs(pct) < 0.05");
    // the chart draws SQL figures as they are: a zero is a value, a missing day is a gap
    expect(comp("money-chart.tsx")).toContain("!== 0");
    expect(comp("money-band.tsx")).toContain("s.value !== 0");
  });
  test("money chart reads kpi_daily from SQL", () => {
    expect(readFileSync(files[0], "utf8")).toContain('rpc("kpi_daily"');
    expect(comp("money-chart.tsx")).not.toMatch(/\/ ?\w*(revenue|costs)|revenue ?[-*] |profit ?=/);
  });
  test("both daily callers limit kpi_daily to the latest days", () => {
    const stats = readFileSync(path.resolve(__dirname, "../../../../components/stats/stats-charts.tsx"), "utf8");
    for (const src of [readFileSync(files[0], "utf8"), stats]) {
      expect(src).toMatch(/rpc\("kpi_daily"[^;]*\.order\("day", \{ ascending: false \}\)\.limit\(KPI_DAILY_MAX_DAYS\)/);
    }
  });
  test("finance cost bar is empty when every cost is zero", () => {
    const src = readFileSync(path.resolve(__dirname, "../money/overview/page.tsx"), "utf8");
    expect(src).toContain("costSlices.some((s) => s.value !== 0)");
  });
  test("the profit waterfall is gone and nothing imports it", () => {
    expect(() => readFileSync(path.resolve(__dirname, "../../../../components/dashboard/pnl-waterfall.tsx"), "utf8")).toThrow();
    const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.tsx?$/.test(e.name) && !e.name.endsWith(".test.ts") ? [path.join(d, e.name)] : []));
    for (const f of walk(path.resolve(__dirname, "../../../../"))) expect(readFileSync(f, "utf8"), f).not.toMatch(/pnl-waterfall|PnlWaterfall/);
  });
  test("dashboard and shipping page share the stuck predicate", () => {
    for (const p of [path.resolve(__dirname, "page.tsx"), path.resolve(__dirname, "../sell/shipping/page.tsx")]) {
      const src = readFileSync(p, "utf8");
      expect(src, p).toMatch(/stuckCutoff\(\)/);
      expect(src, p).toMatch(/AT_COURIER/);
    }
  });

  test("shipping stuck filter keeps the confirmed predicate and a filtered empty table", () => {
    const dir = path.resolve(__dirname, "../sell/shipping");
    const page = readFileSync(path.join(dir, "page.tsx"), "utf8");
    expect(page).toMatch(/confirmation_status", "confirmed"/);
    expect(page).toMatch(/clearHref=\{stuck/);
    expect(readFileSync(path.join(dir, "delivery-table.tsx"), "utf8")).toMatch(/clearHref \?/);
  });
});
