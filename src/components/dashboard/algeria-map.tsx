"use client";

import * as React from "react";
import { geoMercator, geoPath } from "d3-geo";
import { Delaunay } from "d3-delaunay";

import { cn } from "@/lib/utils";
import { WILAYA_CENTROIDS, ALGERIA_OUTLINE } from "@/lib/geo/algeria-wilayas";

export type WilayaMapDatum = {
  code: number;
  name: string | null;
  totalOrders: number;
  deliveryRate: number | null;
  /** SQL `kpi_metric.matured` of the delivery rate; false = grey "not enough data" fill */
  matured: boolean;
};

/** Tooltip text: name (datum → names map → code), then rate and volume, or the no-data label. */
export function wilayaTitle(wd: WilayaMapDatum, noDataLabel: string, names?: Record<number, string>): string {
  const name = wd.name ?? names?.[wd.code] ?? wd.code;
  return wd.totalOrders > 0
    ? `${name} — ${wd.deliveryRate !== null ? `${wd.deliveryRate}%` : "—"} (${wd.totalOrders})`
    : `${name} — ${noDataLabel}`;
}

/** 4-5 step token scale, low → danger, high → success; an unmatured rate
 * (SQL `matured`) renders neutral, never a false extreme. */
export function fillClass(d: WilayaMapDatum): string {
  if (!d.matured || d.deliveryRate === null) return "fill-neutral/30";
  if (d.deliveryRate < 40) return "fill-danger";
  if (d.deliveryRate < 55) return "fill-orange";
  if (d.deliveryRate < 70) return "fill-warning";
  if (d.deliveryRate < 85) return "fill-info";
  return "fill-success";
}

const WIDTH = 340;
const MAX_HEIGHT = 460;
const PAD = 10;

/**
 * Real choropleth: a Mercator projection fit to Algeria's national outline,
 * with each wilaya's cell built as a Voronoi region around its chef-lieu
 * coordinates (real lat/lon, see algeria-wilayas.ts) and clipped to the true
 * border. This repo doesn't carry full per-wilaya administrative boundaries
 * (multi-MB even simplified), so cell edges are Voronoi approximations, not
 * real admin lines — good enough for a "spot the pattern" choropleth; the
 * table beside it is the source of truth for numbers. See
 * `algeria-map.test.ts` for the completeness/uniqueness check.
 */
// Server and client float math can differ in the last digits → hydration
// mismatch on path/viewBox. One decimal is sub-pixel at this size.
const round = (s: string) => s.replace(/-?\d+\.\d+/g, (n) => String(Math.round(Number(n) * 10) / 10));

function useMapGeometry() {
  return React.useMemo(() => {
    const outline: GeoJSON.Feature<GeoJSON.Polygon> = {
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [ALGERIA_OUTLINE] },
    };
    const projection = geoMercator().fitSize([WIDTH, MAX_HEIGHT], outline);
    const pathGen = geoPath(projection);
    const bounds = pathGen.bounds(outline);
    const [[x0, y0], [x1, y1]] = bounds;
    const outlineD = round(pathGen(outline) ?? "");

    const codes = Object.keys(WILAYA_CENTROIDS).map(Number).sort((a, b) => a - b);
    const points: [number, number][] = codes.map((code) => {
      const w = WILAYA_CENTROIDS[code];
      const p = projection([w.lon, w.lat]);
      return p ?? [0, 0];
    });
    const delaunay = new Delaunay(points.flat());
    const voronoi = delaunay.voronoi([x0 - PAD, y0 - PAD, x1 + PAD, y1 + PAD]);
    const cells = codes.map((code, i) => ({ code, d: round(voronoi.renderCell(i) ?? "") }));

    const viewBox = round(`${x0 - PAD} ${y0 - PAD} ${x1 - x0 + PAD * 2} ${y1 - y0 + PAD * 2}`);
    return { outlineD, cells, viewBox };
  }, []);
}

export function AlgeriaMap({
  data,
  hovered,
  onHover,
  onSelect,
  label,
  noDataLabel,
  names,
}: {
  data: WilayaMapDatum[];
  hovered?: number | null;
  onHover?: (code: number | null) => void;
  onSelect?: (code: number) => void;
  label: string;
  noDataLabel: string;
  /** wilaya code -> name, for cells with no order rows */
  names?: Record<number, string>;
}) {
  const clipId = React.useId();
  const { outlineD, cells, viewBox } = useMapGeometry();
  const byCode = new Map(data.map((d) => [d.code, d]));

  return (
    <svg
      viewBox={viewBox}
      className="mx-auto h-auto w-full max-w-[360px]"
      role="img"
      aria-label={label}
    >
      <clipPath id={clipId}>
        <path d={outlineD} />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        {cells.map(({ code, d }) => {
          const wd: WilayaMapDatum = byCode.get(code) ?? {
            code,
            name: null,
            totalOrders: 0,
            deliveryRate: null,
            matured: false,
          };
          const isHovered = hovered === code;
          const titleText = wilayaTitle(wd, noDataLabel, names);
          return (
            <path
              key={code}
              d={d}
              className={cn(
                fillClass(wd),
                "cursor-pointer transition-[stroke-width,opacity]",
                "stroke-background",
                isHovered ? "opacity-100" : "opacity-90",
              )}
              strokeWidth={isHovered ? 1.5 : 0.75}
              strokeLinejoin="round"
              onMouseEnter={() => onHover?.(code)}
              onMouseLeave={() => onHover?.(null)}
              onClick={() => onSelect?.(code)}
            >
              <title>{titleText}</title>
            </path>
          );
        })}
      </g>
      <path d={outlineD} className="pointer-events-none fill-none stroke-border" strokeWidth={1} />
    </svg>
  );
}
