import * as React from "react";

/**
 * Minimal inline-SVG sparkline — a single metric over time, no axes, no deps
 * (components.md chart rules). Uses currentColor so the caller sets the hue via
 * a token text-* class. Renders nothing when there's no variation to show.
 */
export function Sparkline({
  data,
  width = 80,
  height = 24,
  className,
  strokeWidth = 1.5,
}: {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  strokeWidth?: number;
}) {
  // < 2 distinct values carries no trend — render nothing rather than a flat rule.
  if (new Set(data).size < 2) return null;
  const pts = data;
  const max = Math.max(...pts);
  const min = Math.min(...pts);
  const span = max - min || 1;
  const stepX = width / (pts.length - 1);
  const y = (v: number) => height - ((v - min) / span) * (height - strokeWidth) - strokeWidth / 2;
  const d = pts.map((v, i) => `${i === 0 ? "M" : "L"}${(i * stepX).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      fill="none"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path d={d} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
