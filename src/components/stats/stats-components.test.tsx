import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/statistics",
  useSearchParams: () => new URLSearchParams("product=p"),
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (k: string, values?: Record<string, string>) =>
    values ? [k, ...Object.values(values)].join(" ") : k,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { asKpiGroup } from "@/lib/kpi";
import { AlgeriaMap } from "@/components/dashboard/algeria-map";
import { RateBar } from "@/components/stats/rate-bar";
import { MetricCell } from "@/components/stats/metric-cell";
import { DrillBanner } from "@/components/stats/drill-banner";
import { WilayaTable, type StatsRow } from "@/components/stats/wilaya-table";
import { DeliveryComparison, WilayaChart } from "@/components/stats/stats-charts";
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

describe("delivery comparisons", () => {
  const filters = {
    from: "2026-03-10", to: "2026-03-16", source: "manual", category: "c",
    conf_agent: "a", delivery_type: "home",
  };
  test("either comparison links to the same delivered and shipped cohorts", () => {
    const wilayas = renderToStaticMarkup(
      <WilayaChart rows={[row(16), row(31)]} filters={{ ...filters, product: "p" }} productName="Dress" />,
    );
    const products = renderToStaticMarkup(
      <DeliveryComparison title="Products in Alger" dimension="product" filters={{ ...filters, wilaya: "16" }}
        rows={[{ id: "p", name: "Dress", delivery: group(true).rates.delivery }]} />,
    );
    expect(wilayas).toContain("wilayasForProduct Dress");
    expect(products).toContain("Products in Alger");
    for (const html of [products, wilayas]) {
      const links = [...html.matchAll(/href="(\/app\/sell\/orders\?[^"]+)"/g)].map(([, href]) =>
        Object.fromEntries(new URL(href.replaceAll("&amp;", "&"), "http://x").searchParams),
      );
      const cohort = { ...filters, product_id: "p", wilaya_code: "16" };
      expect(links).toContainEqual({ ...cohort, drill: "delivered" });
      expect(links).toContainEqual({ ...cohort, drill: "shipped" });
      expect(html).toContain("25%");
    }
    expect(wilayas).toContain("wilaya_code=31");
  });

  test("empty, zero shipped, and zero delivery with shipments stay distinct", () => {
    const render = (rows: { id: string; name: string; delivery: ReturnType<typeof metric> }[]) =>
      renderToStaticMarkup(<DeliveryComparison title="Comparison" dimension="product" filters={{ wilaya: "16" }} rows={rows} />);
    const empty = render([]);
    expect(empty).toContain("statistics.emptyTitle");
    expect(empty).not.toContain("<table");
    const zero = render([{ id: "p", name: "Dress", delivery: metric(0, 0, false) }]);
    expect(zero).toContain(">—<");
    expect(zero).toContain("statistics.notEnoughData");
    expect(zero).not.toContain("drill=");
    const returned = render([{ id: "p", name: "Dress", delivery: metric(0, 2, false) }]);
    expect(returned).toContain("0%");
    expect(returned).toContain("statistics.notEnoughData");
    expect(returned).toContain("drill=shipped");
    expect(returned).not.toContain("drill=delivered");
    const sqlValue = render([{ id: "p", name: "Dress", delivery: { ...metric(0, 2, true), value: 0.125 } }]);
    expect(sqlValue).toContain("12.5%");
    expect(sqlValue).not.toContain("statistics.notEnoughData");
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
    expect([...DRILL_PARAMS].sort()).toEqual(["commune_key", "commune_label", "commune_unknown", "drill", "hour", "weekday"]);
  });
  test("a label that is not the key's spelling falls back to the key", () => {
    expect(communeBannerLabel("hydra", "  Hydra ")).toBe("Hydra");
    expect(communeBannerLabel("hydra", "Oran")).toBe("hydra");
  });
});
