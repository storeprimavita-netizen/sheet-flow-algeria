/**
 * Pure geometry for the hand-drawn SVG charts (D77, no chart dependency).
 * No React, no money formulas: scales, ticks, thinning and path building only.
 */

export type Scale = (v: number) => number;

/** Linear map domain -> range. A zero-width domain maps to the range middle. */
export function linear(d0: number, d1: number, r0: number, r1: number): Scale {
  if (d1 === d0) return () => (r0 + r1) / 2;
  return (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
}

/** 1, 2, 2.5, 5 x 10^n step that gives about `count` intervals over `span`. */
function niceStep(span: number, count: number): number {
  const raw = span / Math.max(count, 1);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  const m = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return m * pow;
}

/**
 * Axis ticks over [min, max]. The domain always includes 0 (bars start there and
 * a negative profit needs the zero line), so ticks always include 0. `integer` keeps
 * counts on whole steps (never 0.5 orders).
 */
export function niceTicks(min: number, max: number, count = 4, integer = false): { ticks: number[]; min: number; max: number } {
  const lo = Math.min(0, Number.isFinite(min) ? min : 0);
  const hi = Math.max(0, Number.isFinite(max) ? max : 0);
  if (lo === 0 && hi === 0) return { ticks: [0, 1], min: 0, max: 1 };
  const step = integer ? Math.max(1, Math.round(niceStep(hi - lo, count))) : niceStep(hi - lo, count);
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 1e6; v += step) ticks.push(Math.round(v / step) * step);
  return { ticks, min: start, max: end };
}

/** Indices to label on a crowded axis: at most `maxLabels`, always first and last. */
export function thinIndices(n: number, maxLabels: number): number[] {
  if (n <= 0) return [];
  if (n <= maxLabels) return Array.from({ length: n }, (_, i) => i);
  const step = Math.ceil((n - 1) / Math.max(maxLabels - 1, 1));
  const out: number[] = [];
  for (let i = 0; i < n - 1; i += step) out.push(i);
  // keep the last label clear of its neighbour
  if (n - 1 - out[out.length - 1] < step / 2) out.pop();
  out.push(n - 1);
  return out;
}

/** x of point `i` of `n` in [left, right]; RTL puts the oldest (index 0) at the right. */
export function xAt(i: number, n: number, left: number, right: number, rtl: boolean): number {
  const t = n <= 1 ? 0.5 : i / (n - 1);
  return rtl ? right - t * (right - left) : left + t * (right - left);
}

/** Center x of band `i` of `n` equal bands in [left, right]; RTL mirrors the order. */
export function bandAt(i: number, n: number, left: number, right: number, rtl: boolean): { x: number; w: number } {
  const w = (right - left) / Math.max(n, 1);
  const k = rtl ? n - 1 - i : i;
  return { x: left + k * w + w / 2, w };
}

export type LineSegment = { d: string; dashed: boolean };

/**
 * Path segments for one series. A null value is a gap (never 0). The segment that
 * ends on an immature point is dashed. A lone point yields a zero-length segment
 * (the marker draws it).
 */
export function lineSegments(xs: number[], ys: (number | null)[], immature: boolean[] = []): LineSegment[] {
  const out: LineSegment[] = [];
  let prev: number | null = null;
  for (let i = 0; i < ys.length; i++) {
    const y = ys[i];
    if (y == null) {
      prev = null;
      continue;
    }
    if (prev !== null) {
      out.push({ d: `M${xs[prev].toFixed(1)},${(ys[prev] as number).toFixed(1)}L${xs[i].toFixed(1)},${y.toFixed(1)}`, dashed: !!immature[i] });
    }
    prev = i;
  }
  return out;
}

/** Running total; a null contributes nothing and stays null. */
export function cumulative(values: (number | null)[]): (number | null)[] {
  let run = 0;
  return values.map((v) => {
    if (v == null) return null;
    run += v;
    return run;
  });
}

/** 1 200 -> 1.2k, 3 400 000 -> 3.4M. Axis labels only; tooltips and tables show full values. */
export function compactNumber(v: number): string {
  const a = Math.abs(v);
  const sign = v < 0 ? "−" : "";
  if (a >= 1e6) return `${sign}${trim(a / 1e6)}M`;
  if (a >= 1e3) return `${sign}${trim(a / 1e3)}k`;
  return `${sign}${Math.round(a)}`;
}
const trim = (n: number) => String(Math.round(n * 10) / 10);

export type Slice = { key: string; label: string; value: number };

/** Largest `max - 1` slices stay, the rest fold into one "Other" slice. Zero slices are dropped. */
export function collapseSlices(slices: Slice[], max: number, otherLabel: string): Slice[] {
  const sorted = slices.filter((s) => s.value > 0).sort((a, b) => b.value - a.value);
  if (sorted.length <= max) return sorted;
  const keep = sorted.slice(0, max - 1);
  const rest = sorted.slice(max - 1).reduce((sum, s) => sum + s.value, 0);
  return [...keep, { key: "other", label: otherLabel, value: rest }];
}

/** Donut arc path (clockwise from 12 o'clock). Angles in turns [0,1]. */
export function arcPath(cx: number, cy: number, r0: number, r1: number, t0: number, t1: number): string {
  const full = t1 - t0 >= 0.9999;
  const end = full ? t0 + 0.9999 : t1;
  const pt = (r: number, t: number) => [cx + r * Math.sin(2 * Math.PI * t), cy - r * Math.cos(2 * Math.PI * t)];
  const [x0, y0] = pt(r1, t0);
  const [x1, y1] = pt(r1, end);
  const [x2, y2] = pt(r0, end);
  const [x3, y3] = pt(r0, t0);
  const large = end - t0 > 0.5 ? 1 : 0;
  const f = (n: number) => n.toFixed(2);
  return `M${f(x0)},${f(y0)}A${r1},${r1} 0 ${large} 1 ${f(x1)},${f(y1)}L${f(x2)},${f(y2)}A${r0},${r0} 0 ${large} 0 ${f(x3)},${f(y3)}Z`;
}

/** Wilayas/products "worst first" only among groups with enough orders. */
export function worstFirst<T>(rows: T[], count: (r: T) => number, rate: (r: T) => number | null, minCount: number, limit: number): T[] {
  return rows
    .filter((r) => count(r) >= minCount && rate(r) != null)
    .sort((a, b) => (rate(a) as number) - (rate(b) as number) || count(b) - count(a))
    .slice(0, limit);
}
