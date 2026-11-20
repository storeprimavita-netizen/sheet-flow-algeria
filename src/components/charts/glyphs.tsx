import type { Marker } from "./types";

/** Marker outline centred on (x, y). Series differ by shape and dash as well as colour. */
export function markerPath(kind: Marker, x: number, y: number, r: number): string {
  if (kind === "square") return `M${x - r},${y - r}h${2 * r}v${2 * r}h${-2 * r}Z`;
  if (kind === "diamond") return `M${x},${y - r * 1.3}L${x + r * 1.3},${y}L${x},${y + r * 1.3}L${x - r * 1.3},${y}Z`;
  return `M${x - r},${y}a${r},${r} 0 1 0 ${2 * r},0a${r},${r} 0 1 0 ${-2 * r},0Z`;
}

/** Legend / tooltip key: the series line, dash and marker in one small glyph. */
export function SeriesKey({ color, dash, marker }: { color: string; dash?: string; marker?: Marker }) {
  return (
    <svg width="26" height="12" viewBox="0 0 26 12" aria-hidden className="shrink-0">
      {marker ? (
        <>
          <path d="M1,6H25" stroke={color} strokeWidth="2" strokeDasharray={dash} fill="none" />
          <path d={markerPath(marker, 13, 6, 3.2)} fill={color} stroke="var(--surface)" strokeWidth="1" />
        </>
      ) : (
        <rect x="6" y="1" width="14" height="10" rx="2" fill={color} />
      )}
    </svg>
  );
}
