"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChevronRight, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/button-link";
import { SwapBadge } from "@/components/swap-badge";
import { StatusPill } from "@/components/status-pill";
import { PhoneLinks } from "@/components/phone-links";
import { StatusSelect } from "@/components/status-select";
import { DataTable } from "@/components/data-table/data-table";
import type { Column } from "@/components/data-table/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { getStatus } from "@/lib/statuses";
import { pushOrdersToZRExpress, updateOrderStatus } from "../orders/actions";
import type { DelivRow } from "./delivery-view";
import { OrderNo } from "@/components/order-no";

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

export function DeliveryTable({ rows, toolbar, isAdmin }: { rows: DelivRow[]; toolbar?: React.ReactNode; isAdmin: boolean }) {
  const t = useTranslations();
  const router = useRouter();
  const advance = useAdvanceDelivery();
  const [sending, setSending] = React.useState(false);

  // 📦 Bulk "Send to ZR" (admin): rows already sent are reported as failed, not re-sent.
  async function sendToZR(ids: string[], clear: () => void) {
    setSending(true);
    const res = await pushOrdersToZRExpress(ids);
    setSending(false);
    const msg = t("settings.zrexpress.bulkSent", { sent: res.sent, failed: res.failed.length });
    if (res.failed.length) toast.warning(`${msg} — ${res.failed[0].error}`);
    else toast.success(msg);
    clear();
    router.refresh();
  }

  const columns: Column<DelivRow>[] = [
    {
      id: "order_seq",
      header: t("orders.numberHeader"),
      sticky: true,
      cell: (r) => (
        <span className="flex items-center gap-2">
          <span className={"h-4 w-0.5 rounded " + (accent(r.delivery_status) || "bg-transparent")} aria-hidden />
          <span className="flex flex-col items-start gap-1">
            <Link href={`/app/sell/orders/${r.id}`} onClick={(e) => e.stopPropagation()} className="num whitespace-nowrap font-medium hover:underline">
              <OrderNo seq={r.order_seq} />
            </Link>
            {r.swapped_to ? <SwapBadge to={r.swapped_to} /> : null}
          </span>
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
          <div className="text-xs text-muted-foreground">
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
      selectable={isAdmin}
      bulkActions={(keys, clear) => (
        <Button size="sm" variant="outline" disabled={sending} onClick={() => sendToZR(keys, clear)}>
          <Truck className="h-4 w-4" />
          {t("settings.zrexpress.sendToZR")}
        </Button>
      )}
      empty={{
        title: t("orders.none"),
        description: t("orders.deliveryEmptyHint"),
        action: <ButtonLink href="/app/sell/orders" size="sm">{t("orders.tabs.all")}</ButtonLink>,
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
      <ChevronRight className="h-4 w-4 rtl:-scale-x-100" />
    </Button>
  );
}
