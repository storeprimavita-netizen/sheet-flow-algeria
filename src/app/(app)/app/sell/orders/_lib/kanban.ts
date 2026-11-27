import {
  CLEARED, FILTER_KEYS, serializePresentation, type KanbanGroup, type SearchParams, type ViewConfig,
  type ViewPresentation, type ViewScope,
} from "@/lib/order-views";
import { allStatuses, getStatus, statusOptionsFor } from "@/lib/statuses";
import type { ScoreSummary } from "../../confirmation/_lib/customer-score";
import type { SwapTo } from "./swap-links";

export type KanbanStage = "confirmation" | "delivery";
export type KanbanRow = {
  id: string;
  orderSeq: number;
  customerName: string | null;
  customerPhone: string | null;
  productId: string | null;
  productName: string | null;
  wilayaCode: number | null;
  wilayaName: string | null;
  status: string;
  deliveryStatus?: string;
  attempts?: number;
  total?: number;
  age?: string;
  score?: { value: number; reason?: string };
  customerRisk?: ScoreSummary | null;
  locked?: boolean;
  swappedTo?: SwapTo | null;
  duplicate?: boolean;
  /** translated callback line (Confirmation only) */
  callback?: string;
};

export type KanbanColumn = { key: string; label: string | null; rows: KanbanRow[] };

export function kanbanStage(scope: ViewScope): KanbanStage {
  return scope === "shipping" ? "delivery" : "confirmation";
}

export function kanbanTargets(scope: ViewScope, isAdmin: boolean, row: KanbanRow) {
  const stage = kanbanStage(scope);
  if ((!isAdmin && scope !== "confirmation") || row.locked || row.status === "swap" || row.deliveryStatus === "swap" || !getStatus(stage, row.status)) {
    return [];
  }
  return statusOptionsFor(stage, row.status).filter((status) => status.key !== row.status);
}

export function canDropOnColumn(
  scope: ViewScope, isAdmin: boolean, group: KanbanGroup, row: KanbanRow, target: string,
) {
  return group === "status" && kanbanTargets(scope, isAdmin, row).some((status) => status.key === target);
}

export function groupKanbanRows(rows: KanbanRow[], group: KanbanGroup, stage: KanbanStage): KanbanColumn[] {
  const columns = new Map<string, KanbanColumn>();
  if (group === "status") {
    for (const status of allStatuses(stage)) {
      if (status.key !== "swap" || rows.some((row) => row.status === "swap")) {
        columns.set(status.key, { key: status.key, label: null, rows: [] });
      }
    }
  }
  for (const row of rows) {
    const fact = group === "status" ? row.status : group === "attempts" ? row.attempts :
      group === "wilaya" ? row.wilayaCode : row.productId;
    const key = fact == null ? "missing" : String(fact);
    const label = group === "wilaya" ? row.wilayaName : group === "product" ? row.productName :
      fact == null ? null : String(fact);
    let column = columns.get(key);
    if (!column) {
      column = { key, label, rows: [] };
      columns.set(key, column);
    }
    column.rows.push(row);
  }
  const result = [...columns.values()];
  if (group === "attempts" || group === "wilaya") {
    result.sort((a, b) => (a.key === "missing" ? Infinity : Number(a.key)) -
      (b.key === "missing" ? Infinity : Number(b.key)));
  }
  return result;
}

export function moveKanbanRow(rows: KanbanRow[], move: { orderId: string; status: string }) {
  return rows.map((row) => row.id === move.orderId ? { ...row, status: move.status } : row);
}

export function boardResetHref(
  path: string, sp: SearchParams, config: ViewConfig | undefined, presentation: ViewPresentation,
) {
  const reset = serializePresentation(new URLSearchParams(), presentation);
  for (const key of ["view", "show"]) {
    const value = sp[key];
    if (typeof value === "string" && value) reset.set(key, value);
  }
  for (const key of FILTER_KEYS) {
    if (config?.[key] !== undefined) reset.set(key, CLEARED);
  }
  return `${path}?${reset.toString()}`;
}

export function boardShowClosedHref(path: string, sp: SearchParams) {
  const next = new URLSearchParams(Object.entries(sp).flatMap(([key, value]) =>
    typeof value === "string" ? [[key, value]] : [],
  ));
  if (next.get("show") === "all") next.delete("show");
  else next.set("show", "all");
  return `${path}${next.size ? `?${next}` : ""}`;
}
