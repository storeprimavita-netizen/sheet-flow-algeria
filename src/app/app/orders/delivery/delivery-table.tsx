"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/button-link";
import { StatusPill } from "@/components/status-pill";
import { PhoneLinks } from "@/components/phone-links";
import { StatusSelect } from "@/components/status-select";
import { DataTable } from "@/components/data-table/data-table";
import type { Column } from "@/components/data-table/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { getStatus } from "@/lib/statuses";
import { updateOrderStatus } from "../actions";
import type { DelivRow } from "./delivery-view";

/** Apply a delivery-status change; toast + refresh. Shared by table + kanban. */
export function useAdvanceDelivery() {
  const t = useTranslations();
  const router = useRouter();
  return React.useCallback(
    async (orderId: string, status: string): Promise<boolean> => {
      const res = await updateOrderStatus({ orderId, stage: "delivery", status, comment: "" });
      if (!res.ok) {
        toast.error(res.error);
        return false;
      }
      toast.success(t("common.updated"));
      router.refresh();
      return true;
    },
    [router, t],
  );
}

/** delayed / returning rows get a colored leading bar to stand out. */
function accent(status: string): string {
  if (status === "delayed") return "bg-warning";
  if (status === "returning" || status === "returned") return "bg-orange";
  return "";
}

export function DeliveryTable({ rows, toolbar }: { rows: DelivRow[]; toolbar?: React.ReactNode }) {
  const t = useTranslations();
  const advance = useAdvanceDelivery();

  const columns: Column<DelivRow>[] = [
    {
      id: "order_number",
      header: t("orders.title"),
      sticky: true,
      cell: (r) => (
        <span className="flex items-center gap-2">
          <span className={"h-4 w-0.5 rounded " + (accent(r.delivery_status) || "bg-transparent")} aria-hidden />
          <span className="num font-medium">{r.order_number ?? r.id.slice(0, 8)}</span>
        </span>
      ),
    },
    {
      id: "customer",
      header: t("fields.customer"),
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate">{r.customer_name ?? "—"}</div>
          {r.customer_phone ? (
            <PhoneLinks phone={r.customer_phone} callLabel={t("orders.call")} waLabel={t("orders.whatsapp")} />
          ) : null}
        </div>
      ),
    },
    { id: "product", header: t("fields.product"), cell: (r) => <span className="truncate">{r.product_name ?? "—"}</span> },
    { id: "quantity", header: t("fields.quantity"), numeric: true, cell: (r) => <span className="num">{r.quantity}</span> },
    {
      id: "to_collect",
      header: t("orders.toCollect"),
      numeric: true,
      cell: (r) => (
        <div className="whitespace-nowrap">
          <div className="num font-medium">{formatCurrency(r.to_collect)}</div>
          <div className="num text-xs text-muted-foreground">
            {t("fields.delivery_fee")}: {formatCurrency(r.delivery_fee ?? 0)}
          </div>
        </div>
      ),
    },
    {
      id: "tracking",
      header: t("orders.tracking"),
      cell: (r) =>
        r.tracking_number ? (
          <div className="min-w-0">
            <div className="num truncate text-xs font-medium">{r.tracking_number}</div>
            {r.zr_state ? <div className="truncate text-xs text-muted-foreground">{r.zr_state}</div> : null}
          </div>
        ) : (
          <span className="text-faint">—</span>
        ),
    },
    { id: "wilaya", header: t("fields.wilaya"), cell: (r) => r.wilaya_name ?? "—" },
    { id: "delivery_type", header: t("fields.delivery_type"), cell: (r) => t(`status.delivery_type.${r.delivery_type}`) },
    {
      id: "status",
      header: t("fields.delivery_status"),
      align: "center",
      cell: (r) => (
        <div onClick={(e) => e.stopPropagation()} className="flex items-center justify-center gap-1">
          <StatusSelect kind="delivery" value={r.delivery_status} onChange={(v) => advance(r.id, v)} className="w-44" />
          <QuickAdvance row={r} advance={advance} />
        </div>
      ),
    },
    { id: "placed_at", header: t("fields.placed_at"), cell: (r) => formatDate(r.placed_at) },
  ];

  return (
    <DataTable<DelivRow>
      tableId="orders-delivery"
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      defaultDensity="compact"
      toolbar={toolbar}
      empty={{
        title: t("orders.none"),
        description: t("orders.deliveryEmptyHint"),
        action: <ButtonLink href="/app/orders/all" size="sm">{t("orders.tabs.all")}</ButtonLink>,
      }}
    />
  );
}

function QuickAdvance({ row, advance }: { row: DelivRow; advance: (id: string, s: string) => Promise<boolean> }) {
  const t = useTranslations();
  const nextKey = getStatus("delivery", row.delivery_status)?.next[0];
  const nextDef = nextKey ? getStatus("delivery", nextKey) : undefined;
  // Fixed-width slot even when there's no next step, so pills line up.
  if (!nextDef) return <span className="h-7 w-7 shrink-0" aria-hidden />;
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7"
      aria-label={`${t("orders.advanceTo")} ${t(nextDef.label)}`}
      title={`${t("orders.advanceTo")} ${t(nextDef.label)}`}
      onClick={() => advance(row.id, nextDef.key)}
    >
      <ChevronRight className="h-4 w-4" />
    </Button>
  );
}
