"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { Chip } from "@/components/ui/chip";
import { StatusPill } from "@/components/status-pill";
import { StatusSelect } from "@/components/status-select";
import { formatCurrency, formatDate } from "@/lib/format";
import { DELIVERY_STATUSES } from "@/lib/enums";
import { useAdvanceDelivery } from "./delivery-table";
import type { DelivRow } from "./delivery-view";

/**
 * Delivery kanban (optional toggle). Columns are the delivery statuses; cards
 * move by drag OR by the on-card StatusSelect (keyboard-accessible equivalent).
 * Free status changes (Phase 14a) — any column accepts a drop, cards are
 * always draggable. Optimistic move, rollback on failure.
 */
export function DeliveryKanban({ rows }: { rows: DelivRow[] }) {
  const t = useTranslations();
  const advance = useAdvanceDelivery();
  const [items, setItems] = React.useState(rows);
  React.useEffect(() => setItems(rows), [rows]);

  const [dragId, setDragId] = React.useState<string | null>(null);

  async function move(id: string, to: string) {
    const card = items.find((r) => r.id === id);
    if (!card || card.delivery_status === to) return;
    const prev = card.delivery_status;
    setItems((list) => list.map((r) => (r.id === id ? { ...r, delivery_status: to } : r)));
    const ok = await advance(id, to);
    if (!ok) setItems((list) => list.map((r) => (r.id === id ? { ...r, delivery_status: prev } : r))); // rollback
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {DELIVERY_STATUSES.map((status) => {
        const col = items.filter((r) => r.delivery_status === status);
        return (
          <div
            key={status}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragId) move(dragId, status);
              setDragId(null);
            }}
            className="flex w-64 shrink-0 flex-col gap-2 rounded-xl bg-surface p-2"
          >
            <div className="flex items-center justify-between px-1">
              <StatusPill kind="delivery" status={status} size="sm" />
              <span className="num text-xs text-muted-foreground">{col.length}</span>
            </div>
            {col.length === 0 ? (
              <p className="px-1 py-6 text-center text-xs text-muted-foreground">{t("orders.kanbanEmpty")}</p>
            ) : (
              col.map((r) => (
                <div
                  key={r.id}
                  draggable
                  onDragStart={() => setDragId(r.id)}
                  onDragEnd={() => setDragId(null)}
                  className="card-surface space-y-2 rounded-lg p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="num font-medium">{r.order_number ?? r.id.slice(0, 8)}</span>
                    <span className="num text-xs text-muted-foreground">{formatCurrency(r.delivery_fee ?? 0)}</span>
                  </div>
                  <div className="truncate text-muted-foreground">{r.customer_name ?? "—"}</div>
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="truncate">{r.product_name ?? "—"}</span>
                    <Chip token="neutral" size="sm">
                      {r.wilaya_name ?? "—"}
                    </Chip>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <StatusSelect kind="delivery" value={r.delivery_status} onChange={(v) => move(r.id, v)} className="w-auto min-w-[8.5rem]" />
                    <span className="text-xs text-muted-foreground">{formatDate(r.placed_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}
