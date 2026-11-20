import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/statistics",
  useSearchParams: () => new URLSearchParams("product=p"),
}));
vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

import { asKpiGroup } from "@/lib/kpi";
import { AlgeriaMap } from "@/components/dashboard/algeria-map";
import { RateBar } from "@/components/stats/rate-bar";
import { MetricCell } from "@/components/stats/metric-cell";
import { DrillBanner } from "@/components/stats/drill-banner";
import { WilayaTable, type StatsRow } from "@/components/stats/wilaya-table";
import { communeBannerLabel, DRILL_PARAMS } from "@/lib/query-string";

const metric = (num: number, den: number, matured: boolean) => ({ num, den, value: den ? num / den : null, matured });
const group = (matured: boolean) =>
  asKpiGroup(
    {
      confirmation: metric(3, 4, matured), delivery: metric(1, 4, matured), return: metric(1, 4, matured),
      counts: { received: 4, confirmed: 3, delivered: 1 },
    },
    { shipped: 2, home_count: 1, stopdesk_count: 1, avg_days_to_deliver: null, avg_days_sample: 0 },
  )!;

const row = (code: number | null, matured = true): StatsRow => ({ code, name: code === null ? null : `W${code}`, group: group(matured) });
const table = (rows: StatsRow[], openWilaya: number | null, hovered: number | null = null) =>
  renderToStaticMarkup(
    <WilayaTable rows={rows} filters={{ from: "2026-03-01" }} openWilaya={openWilaya} panel={<i>panel</i>} hovered={hovered} onHover={() => {}} />,
  );

describe("WilayaTable", () => {
  test("chevron aria-expanded follows the open row; aria-controls only while open", () => {
    const closed = table([row(16)], null);
    expect(closed).toContain('aria-expanded="false"');
    expect(closed).not.toContain("aria-controls");
    const open = table([row(16)], 16);
    expect(open).toContain('aria-expanded="true"');
    expect(open).toContain('aria-controls="commune-panel-16"');
    expect(open).toContain('id="commune-panel-16"');
  });
  test("the unknown-wilaya row has no chevron link and no drill link, and is never hovered", () => {
    const html = table([row(null)], null, null);
    expect(html).not.toContain("aria-expanded");
    expect(html).not.toContain("/app/sell/orders");
    expect(html).not.toMatch(/<(tr|td) class="[^"]*bg-surface-raised/);
    // a real hovered row does get the highlight
    expect(table([row(16)], null, 16)).toMatch(/<tr class="[^"]*bg-surface-raised/);
  });
  test("unmatured cells render the reason as screen-reader text", () => {
    expect(table([row(16, false)], null)).toContain(">statistics.notEnoughData<");
    expect(table([row(16, true)], null)).not.toContain("statistics.notEnoughData");
  });
});

describe("MetricCell", () => {
  test("shows visible marker text only when unmatured", () => {
    const un = renderToStaticMarkup(<MetricCell m={metric(1, 3, false)} title="Not enough" />);
    expect(un).toContain(">Not enough<");
    expect(un).toContain("<svg");
    expect(renderToStaticMarkup(<MetricCell m={metric(8, 10, true)} title="Not enough" />)).not.toContain("Not enough");
  });
});

describe("unmatured rendering", () => {
  test("RateBar matured=false is neutral", () => {
    expect(renderToStaticMarkup(<RateBar pct={90} matured={false} />)).not.toMatch(/bg-(success|warning|danger)/);
  });
  test("AlgeriaMap with matured=false data renders neutral cells, not status fills", () => {
    const html = renderToStaticMarkup(
      <AlgeriaMap data={[{ code: 16, name: "Alger", totalOrders: 3, deliveryRate: 90, matured: false }]} label="map" noDataLabel="none" />,
    );
    expect(html).toContain("fill-neutral/30");
    expect(html).not.toMatch(/fill-(success|danger|warning)/);
  });
});

describe("DrillBanner and drill params", () => {
  test("renders the metric and the parts in order, skipping empty ones", () => {
    const html = renderToStaticMarkup(<DrillBanner metric="Shipped orders" parts={["Alger", "", "Hydra"]} clearLabel="Show all" />);
    expect(html).toContain("Shipped orders");
    expect(html).toContain(" · Alger · Hydra");
  });
  test("the way out links to the bare orders list (no drill params)", () => {
    const html = renderToStaticMarkup(<DrillBanner metric="m" parts={[]} clearLabel="Show all" />);
    expect(html).toContain('href="/app/sell/orders"');
    expect(html).not.toContain("drill=");
  });
  test("leaving drill mode removes drill, commune_key, commune_unknown and commune_label", () => {
    expect([...DRILL_PARAMS].sort()).toEqual(["commune_key", "commune_label", "commune_unknown", "drill"]);
  });
  test("a label that is not the key's spelling falls back to the key", () => {
    expect(communeBannerLabel("hydra", "  Hydra ")).toBe("Hydra");
    expect(communeBannerLabel("hydra", "Oran")).toBe("hydra");
  });
});
