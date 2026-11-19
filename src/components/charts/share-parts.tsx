import { formatPercent } from "@/lib/format";
import { LegendItem } from "./chart-panel";

export type ShareSlice = { key: string; label: string; value: number; display: string; color: string; href?: string };

/** Share of the total as a one-decimal percent (display only). */
export const shareOf = (value: number, total: number) => formatPercent(total > 0 ? Math.round((value / total) * 1000) / 10 : 0);

/** Legend carrying the amount and the share for donut and stacked bar. */
export function shareLegend(slices: ShareSlice[], total: number) {
  return slices.map((s) => <LegendItem key={s.key} label={<bdi>{s.label}</bdi>} color={s.color} value={`${s.display} · ${shareOf(s.value, total)}`} />);
}

export function shareTable(title: string, head: [string, string, string], slices: ShareSlice[], total: number) {
  return { caption: title, head, rows: slices.map((s) => [s.label, s.display, shareOf(s.value, total)]) };
}
