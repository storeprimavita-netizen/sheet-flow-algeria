import { isValidElement, type ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";

vi.mock("next-intl/server", () => ({ getTranslations: async () => (k: string) => `t:${k}` }));

import { NeedsActionBand } from "./needs-action-band";
import { MoneyBand } from "./money-band";
import { OrderJourney } from "./order-journey";
import { StockStrip } from "./stock-strip";
import { ProductScorecard } from "./product-scorecard";
import type { Kpi } from "@/lib/kpi";

/** Only the dashboard's own server components are expanded; shared tiles stay leaves so their props can be read. */
const OWN = new Set(["Band", "BandError", "NeedsActionBand", "MoneyBand", "OrderJourney", "StockStrip", "ProductScorecard"]);
type Node = { type: unknown; props: Record<string, unknown> };

async function resolve(node: ReactNode): Promise<Node[]> {
  if (Array.isArray(node)) return (await Promise.all(node.map(resolve))).flat();
  if (!isValidElement(node)) return [];
  const props = node.props as Record<string, unknown>;
  const type = node.type as { name?: string };
  if (typeof type === "function" && OWN.has(type.name ?? "")) {
    return resolve(await (type as (p: unknown) => Promise<ReactNode> | ReactNode)(props));
  }
  return [{ type: node.type, props }, ...(await resolve(props.children as ReactNode))];
}
const nodes = async (el: ReactNode) => resolve(await el);
const name = (n: Node) => (typeof n.type === "function" ? (n.type as { name: string }).name : String(n.type));
const by = (ns: Node[], n: string) => ns.filter((x) => name(x) === n);

const kpi = (over: Partial<Kpi> = {}) =>
  ({
    counts: { received: 10, confirmed: 8, delivered: 5, returned: 1, swapped: 0, in_flight: 2, on_road_orders: 3, on_road_units: 3 },
    usd_rate: 200,
    net_profit: 0,
    waterfall: { revenue: 0, cogs: 0, returns: 0, ads: 0, expenses_fixed: 0 },
    ...over,
  }) as unknown as Kpi;

describe("dashboard bands render", () => {
  test("error state with retry in every band", async () => {
    const trees = [
      await nodes(NeedsActionBand({ counts: null })),
      await nodes(MoneyBand({ kpi: null, prev: null, hrefs: { revenue: "", ads: "", finance: "" } })),
      await nodes(StockStrip({ rows: null })),
      await nodes(ProductScorecard({ rows: null, hasProducts: true })),
      await nodes(OrderJourney({ kpi: null, hrefs: { received: "", confirmed: "", onRoad: "", delivered: "" } })),
    ];
    for (const t of trees) {
      expect(t.some((n) => n.props.role === "alert")).toBe(true);
      expect(by(t, "RetryButton")).toHaveLength(1);
    }
  });

  test("stock empty offers an action", async () => {
    const t = await nodes(StockStrip({ rows: [] }));
    expect(by(t, "ButtonLink")[0]?.props.href).toBe("/app/catalog/products/new");
  });

  test("scorecard: no period vs no products", async () => {
    const texts = async (hasProducts: boolean) => (await nodes(ProductScorecard({ rows: [], hasProducts }))).flatMap((n) => (typeof n.props.children === "string" ? [n.props.children] : []));
    expect(await texts(true)).toContain("t:noPeriod");
    expect(await texts(false)).toContain("t:empty");
  });

  test("no delta for 0 vs 0", async () => {
    const t = await nodes(MoneyBand({ kpi: kpi({ net_profit: 0 }), prev: kpi({ net_profit: 0 }), hrefs: { revenue: "", ads: "", finance: "" } }));
    expect(by(t, "KpiTile").length).toBeGreaterThan(0);
    for (const tile of by(t, "KpiTile")) expect(tile.props.delta ?? null).toBeNull();
  });

  test("cost per delivered carries its sub-line", async () => {
    const t = await nodes(MoneyBand({ kpi: kpi(), prev: null, hrefs: { revenue: "", ads: "", finance: "" } }));
    expect(by(t, "KpiTile").find((x) => x.props.label === "t:costPerDelivered")?.props.sub).toBe("t:costPerDeliveredSub");
  });

  test("journey: both drops neutral-labelled, nothing red", async () => {
    const t = await nodes(OrderJourney({ kpi: kpi(), hrefs: { received: "", confirmed: "", onRoad: "", delivered: "" } }));
    const stages = by(t, "Funnel")[0].props.stages as { label: string; dropNote?: string }[];
    expect(stages.find((s) => s.label === "t:confirmed")?.dropNote).toBe("t:vsReceived");
    expect(stages.find((s) => s.label === "t:delivered")?.dropNote).toBe("t:vsConfirmed");
    expect(JSON.stringify(stages)).not.toContain("text-danger");
  });

  test("stock: Delivered column hidden below sm but still rendered", async () => {
    const row = { productId: "p1", name: "P", inStock: 1, reserved: 0, onRoad: 0, delivered: 4, low: false };
    const t = await nodes(StockStrip({ rows: [row] }));
    const hidden = t.filter((n) => typeof n.props.className === "string" && n.props.className.includes("hidden") && n.props.className.includes("sm:flex"));
    expect(hidden).toHaveLength(1);
  });

  test("stuck tile opens the filtered shipping queue", async () => {
    const t = await nodes(NeedsActionBand({ counts: { toConfirm: 0, toShip: 0, toRetry: 0, stuck: 2 } }));
    expect(by(t, "KpiTile").find((x) => x.props.label === "t:stuck")?.props.href).toBe("/app/sell/shipping?stuck=1");
  });
});
