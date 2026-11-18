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
});
