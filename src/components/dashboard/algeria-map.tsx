"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Approximate grid cartogram of Algeria's 58 wilayas — NOT true borders (no
 * geodata/mapping library in this repo, per components.md "no heavy mapping
 * library, no tiles"). Each wilaya gets one hand-placed (col,row) cell,
 * grouped west→east / north→south so the overall shape reads as Algeria
 * (wide Mediterranean north narrowing into the Sahara), good enough for
 * "spotting patterns" — the table beside it is the source of truth for
 * numbers. See `algeria-map.test.ts` for the completeness/uniqueness check.
 */
export const WILAYA_GRID: Record<number, { x: number; y: number }> = {
  13: { x: 0, y: 0 }, 46: { x: 1, y: 0 }, 31: { x: 2, y: 0 }, 27: { x: 3, y: 0 },
  2: { x: 4, y: 0 }, 42: { x: 5, y: 0 }, 16: { x: 6, y: 0 }, 35: { x: 7, y: 0 },
  15: { x: 8, y: 0 }, 6: { x: 9, y: 0 }, 18: { x: 10, y: 0 }, 21: { x: 11, y: 0 },
  23: { x: 12, y: 0 }, 36: { x: 13, y: 0 },

  22: { x: 0.5, y: 1 }, 29: { x: 1.5, y: 1 }, 48: { x: 2.5, y: 1 }, 44: { x: 3.5, y: 1 },
  26: { x: 4.5, y: 1 }, 9: { x: 5.5, y: 1 }, 10: { x: 6.5, y: 1 }, 34: { x: 7.5, y: 1 },
  19: { x: 8.5, y: 1 }, 43: { x: 9.5, y: 1 }, 25: { x: 10.5, y: 1 }, 24: { x: 11.5, y: 1 },
  41: { x: 12.5, y: 1 },

  45: { x: 1.5, y: 2 }, 32: { x: 2.5, y: 2 }, 20: { x: 3.5, y: 2 }, 14: { x: 4.5, y: 2 },
  38: { x: 5.5, y: 2 }, 17: { x: 6.5, y: 2 }, 28: { x: 7.5, y: 2 }, 5: { x: 8.5, y: 2 },
  40: { x: 9.5, y: 2 }, 4: { x: 10.5, y: 2 }, 12: { x: 11.5, y: 2 },

  8: { x: 2.5, y: 3 }, 3: { x: 3.5, y: 3 }, 47: { x: 4.5, y: 3 }, 30: { x: 5.5, y: 3 },
  7: { x: 6.5, y: 3 }, 51: { x: 7.5, y: 3 }, 55: { x: 8.5, y: 3 }, 39: { x: 9.5, y: 3 },
  57: { x: 10.5, y: 3 },

  37: { x: 2, y: 4 }, 52: { x: 4.5, y: 4 }, 49: { x: 6.5, y: 4 }, 58: { x: 9, y: 4 },

  50: { x: 3, y: 5 }, 1: { x: 5.5, y: 5 }, 53: { x: 8, y: 5 },

  11: { x: 5.5, y: 6 }, 33: { x: 9, y: 6 },

  54: { x: 5.5, y: 7 }, 56: { x: 9, y: 7 },
};

export type WilayaMapDatum = {
  code: number;
  name: string | null;
  totalOrders: number;
  confirmedOrders: number;
  deliveryRate: number | null;
  stopShippingManual: boolean;
  stopShippingAuto: boolean;
};

/** 4-5 step token scale, low → danger, high → success; below the min-orders
 * threshold (same confirmed-orders denominator the stop-shipping-auto flag
 * uses) renders neutral, never a false extreme. */
function fillClass(d: WilayaMapDatum, minOrders: number): string {
  if (d.confirmedOrders < minOrders || d.deliveryRate === null) return "fill-neutral/30";
  if (d.deliveryRate < 40) return "fill-danger";
  if (d.deliveryRate < 55) return "fill-orange";
  if (d.deliveryRate < 70) return "fill-warning";
  if (d.deliveryRate < 85) return "fill-info";
  return "fill-success";
}

const CELL = 30;
const PAD = 16;

export function AlgeriaMap({
  data,
  minOrders,
  hovered,
  onHover,
  onSelect,
}: {
  data: WilayaMapDatum[];
  minOrders: number;
  hovered?: number | null;
  onHover?: (code: number | null) => void;
  onSelect?: (code: number) => void;
}) {
  const byCode = new Map(data.map((d) => [d.code, d]));
  const maxX = Math.max(...Object.values(WILAYA_GRID).map((p) => p.x));
  const maxY = Math.max(...Object.values(WILAYA_GRID).map((p) => p.y));
  const width = (maxX + 1) * CELL + PAD * 2;
  const height = (maxY + 1) * CELL + PAD * 2;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="mx-auto h-auto w-full max-w-[360px]"
      role="img"
      aria-label="Delivery rate by wilaya"
    >
      {Object.entries(WILAYA_GRID).map(([codeStr, pos]) => {
        const code = Number(codeStr);
        const d: WilayaMapDatum = byCode.get(code) ?? {
          code,
          name: null,
          totalOrders: 0,
          confirmedOrders: 0,
          deliveryRate: null,
          stopShippingManual: false,
          stopShippingAuto: false,
        };
        const isHovered = hovered === code;
        const cx = PAD + pos.x * CELL + CELL / 2;
        const cy = PAD + pos.y * CELL + CELL / 2;
        const stopFlag = d.stopShippingManual || d.stopShippingAuto;
        const titleText = `${d.name ?? d.code}${
          d.totalOrders > 0 ? ` — ${d.deliveryRate !== null ? `${d.deliveryRate}%` : "—"} (${d.totalOrders})` : " — no data"
        }`;
        return (
          <rect
            key={code}
            x={cx - CELL / 2 + 2}
            y={cy - CELL / 2 + 2}
            width={CELL - 4}
            height={CELL - 4}
            rx={4}
            className={cn(
              fillClass(d, minOrders),
              "cursor-pointer transition-[stroke-width,opacity]",
              stopFlag ? "stroke-danger" : "stroke-border",
              isHovered ? "opacity-100" : "opacity-90",
            )}
            strokeWidth={stopFlag ? 2 : isHovered ? 1.5 : 0.5}
            onMouseEnter={() => onHover?.(code)}
            onMouseLeave={() => onHover?.(null)}
            onClick={() => onSelect?.(code)}
          >
            <title>{titleText}</title>
          </rect>
        );
      })}
    </svg>
  );
}
