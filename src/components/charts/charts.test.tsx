import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import en from "@/messages/en.json";
import ar from "@/messages/ar.json";
import { collapseSlices } from "@/lib/chart-math";
import { formatCurrency } from "@/lib/format";
import { BarChart } from "./bar-chart";
import { ChartPanel, ChartTable } from "./chart-panel";
import { DonutChart } from "./donut-chart";
import { LineChart, lineTable, type LineSeries, type LineX } from "./line-chart";
import { shareTable } from "./share-parts";
import { StackedBar } from "./stacked-bar";

const render = (node: React.ReactNode, locale: "en" | "ar" = "en") =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} timeZone="Africa/Algiers" messages={locale === "en" ? en : ar}>
      {node}
    </NextIntlClientProvider>,
  );

const xs: LineX[] = ["01", "02", "03", "04"].map((d, i) => ({ key: `2026-01-${d}`, label: `${d}/01`, short: d, immature: i === 3, href: `/app/orders/all?from=2026-01-${d}` }));
const series: LineSeries[] = [
  { key: "rev", label: "Revenue", color: "var(--chart-1)", marker: "circle", values: [100, 200, null, 300], format: "dzd" },
  { key: "cost", label: "Costs", color: "var(--chart-2)", dash: "6 4", marker: "square", values: [50, 80, 90, 100], format: "dzd" },
  { key: "net", label: "Net", color: "var(--chart-3)", dash: "2 3", marker: "diamond", values: [50, 120, null, 200], format: "dzd" },
];
const hits = (html: string) => [...html.matchAll(/<rect x="(-?[\d.]+)" y="12" width="([\d.]+)" height="200"[^>]*pointer-events="all"/g)].map((m) => ({ x: Number(m[1]), w: Number(m[2]) }));
const cx = (html: string) => hits(html).map((h) => h.x + h.w / 2);

describe("LineChart", () => {
  test("every point is a link with drill href, aria label and exactly one roving tab stop", () => {
    const html = render(<LineChart title="Money" xs={xs} series={series} />);
    expect(html).toContain('role="group"');
    expect(html).toContain('href="/app/orders/all?from=2026-01-02"');
    expect(html).toContain(`01/01: Revenue ${formatCurrency(100)}`);
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
    // revenue 3 points + costs 4 + net 3 (gaps skipped)
    expect(html.match(/data-pt=/g)).toHaveLength(10);
  });
  test("a null value draws no point (gap, not 0)", () => {
    const html = render(<LineChart title="Money" xs={xs} series={series} />);
    expect(html).not.toContain("03/01: Revenue");
    expect(html).toContain(`03/01: Costs ${formatCurrency(90)}`);
  });
  test("each series differs by dash and marker, not colour only", () => {
    const html = render(<LineChart title="Money" xs={xs} series={series} />);
    expect(html).toContain('stroke-dasharray="6 4"');
    expect(html).toContain('stroke-dasharray="2 3"');
    expect(html).toContain("a3.5,3.5"); // circle marker
    expect(html).toMatch(/M[\d.]+,[\d.]+L[\d.]+,[\d.]+L[\d.]+,[\d.]+L[\d.]+,[\d.]+Z/); // diamond
  });
  test("immature tail is dashed", () => {
    expect(render(<LineChart title="Money" xs={xs} series={series} />)).toContain('stroke-dasharray="1 5"');
  });
  test("RTL: oldest point is at the right (first x > last x); LTR the opposite", () => {
    const ltr = cx(render(<LineChart title="M" xs={xs} series={[series[1]]} />));
    const rtl = cx(render(<LineChart title="M" xs={xs} series={[series[1]]} />, "ar"));
    expect(ltr[0]).toBeLessThan(ltr[ltr.length - 1]);
    expect(rtl[0]).toBeGreaterThan(rtl[rtl.length - 1]);
  });
  test("dense series: adjacent hit bands never overlap", () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ key: `d${i}`, label: `d${i}`, short: `${i}`, href: `/o?d=${i}` }));
    const s = [{ ...series[1], values: many.map((_, i) => i) }];
    const b = hits(render(<LineChart title="M" xs={many} series={s} />)).slice(-60); // the link bands (hover bands come first)
    expect(b.length).toBeGreaterThan(30);
    for (let i = 1; i < b.length; i++) expect(b[i].x).toBeGreaterThanOrEqual(b[i - 1].x + b[i - 1].w - 0.01);
  });
  test("table shows exactly the numbers the plot labels", () => {
    const table = lineTable("Money", xs, series, "No data");
    const html = render(<LineChart title="Money" xs={xs} series={series} />);
    for (const row of table.rows) for (const cell of row.slice(1)) if (cell !== "No data") expect(html).toContain(cell);
    expect(table.rows[2][1]).toBe("No data");
    const tableHtml = render(<ChartTable data={table} />);
    expect(tableHtml).toContain("<caption");
    expect(tableHtml).toContain('scope="col"');
    expect(tableHtml).toContain('scope="row"');
  });
  test("empty state replaces the plot, with its action", () => {
    const html = render(<LineChart title="Money" xs={[]} series={[]} empty={{ title: "Nothing yet", action: { label: "New order", href: "/app/orders/new" } }} />);
    expect(html).toContain("Nothing yet");
    expect(html).toContain('href="/app/orders/new"');
    expect(html).not.toContain("<svg width");
  });
});

describe("ChartPanel table toggle", () => {
  test("is a button with aria-pressed", () => {
    const html = render(<ChartPanel title="T" plot={<i />} table={{ caption: "T", head: ["a"], rows: [["x"]] }} />);
    expect(html).toMatch(/<button[^>]*aria-pressed="false"/);
  });
  test(">90 rows scroll with a sticky header", () => {
    const rows = Array.from({ length: 91 }, (_, i) => [`d${i}`, "1"]);
    const html = render(<ChartTable data={{ caption: "T", head: ["", "v"], rows }} />);
    expect(html).toContain("max-h-80");
    expect(html).toContain("sticky");
  });
});

describe("BarChart", () => {
  const items = [
    { key: "a", label: "Alger", value: 5, display: "5", href: "/app/orders/all?wilaya_code=16" },
    { key: "b", label: "Oran", value: 10, display: "10", href: "/app/orders/all?wilaya_code=31" },
  ];
  test("horizontal rows are 44px links, Latin names isolated with bdi", () => {
    const html = render(<BarChart title="Where" items={items} orientation="h" valueHead="Orders" />);
    expect(html).toContain("min-h-11");
    expect(html).toContain("<bdi>Alger</bdi>");
    expect(html).toContain('href="/app/orders/all?wilaya_code=31"');
  });
  test("vertical RTL mirrors the order", () => {
    const rects = (h: string) => [...h.matchAll(/<rect x="([\d.]+)"[^>]*rx="2"/g)].map((m) => Number(m[1]));
    const l = rects(render(<BarChart title="W" items={items} valueHead="Orders" />));
    const r = rects(render(<BarChart title="W" items={items} valueHead="Orders" />, "ar"));
    expect(l[0]).toBeLessThan(l[1]);
    expect(r[0]).toBeGreaterThan(r[1]);
  });
});

describe("Donut / StackedBar", () => {
  const raw = Array.from({ length: 8 }, (_, i) => ({ key: `k${i}`, label: `L${i}`, value: 10 - i }));
  const slices = collapseSlices(raw, 5, "Other").map((s) => ({ ...s, display: `${s.value} DA`, color: "var(--chart-1)", href: `/app/orders/all?x=${s.key}` }));
  test("donut collapses to 5 slices incl. Other, legend carries amount and %", () => {
    const html = render(<DonutChart title="Outcome" slices={slices} totalLabel="orders" totalDisplay="52" head={["Outcome", "Orders", "Share"]} />);
    expect(html.match(/data-pt=/g)).toHaveLength(5);
    expect(html).toContain("Other");
    expect(html).toContain("%");
    expect(html).toContain('href="/app/orders/all?x=other"');
  });
  test("share table lists the same numbers as the slices", () => {
    const t = shareTable("Outcome", ["a", "b", "c"], slices, 52);
    expect(t.rows).toHaveLength(5);
    expect(t.rows.map((r) => r[1])).toEqual(slices.map((s) => s.display));
  });
  test("stacked bar: one link per non-zero segment", () => {
    const html = render(<StackedBar title="Costs" slices={[...slices, { key: "z", label: "Zero", value: 0, display: "0 DA", color: "var(--chart-2)" }]} head={["Cost", "Amount", "Share"]} />);
    expect(html.match(/data-pt=/g)).toHaveLength(5);
  });
});
