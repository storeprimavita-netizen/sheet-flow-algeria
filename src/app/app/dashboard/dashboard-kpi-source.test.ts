import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

/** P1-2 guard: the dashboard shows SQL figures (kpi_lines) and never re-derives a formula. */
const files = [
  path.resolve(__dirname, "page.tsx"),
  ...readdirSync(path.resolve(__dirname, "../../../components/dashboard"))
    .filter((f) => /^(band|needs-action-band|money-band|order-journey|stock-strip|product-scorecard|usd-first)\.tsx$/.test(f))
    .map((f) => path.resolve(__dirname, "../../../components/dashboard", f)),
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

  const comp = (n: string) => readFileSync(path.resolve(__dirname, "../../../components/dashboard", n), "utf8");
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
    expect(comp("pnl-waterfall.tsx")).toContain("s.value !== 0");
  });
});
