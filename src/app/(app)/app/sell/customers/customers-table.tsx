"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ExternalLink } from "lucide-react";

import { useStatusLabel } from "@/components/status-labels-provider";
import { StatusPill } from "@/components/status-pill";
import { RiskBadge } from "@/components/risk-badge";
import { PhoneLinks } from "@/components/phone-links";
import { DataTable } from "@/components/data-table/data-table";
import type { Column } from "@/components/data-table/types";
import { RateCell } from "@/components/stats/rate-bar";
import { customerDeliveryRate } from "@/lib/customers";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { currentStatus } from "@/lib/statuses";
import { OrderNo } from "@/components/order-no";

export type CustomerOrder = {
  id: string;
  order_seq: number;
  product_name: string | null;
  quantity: number;
  sale_price: number | null;
  confirmation_status: string;
  delivery_status: string;
  placed_at: string | null;
};

export type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  wilaya_name: string | null;
  commune: string | null;
  total_orders: number;
  delivered_orders: number;
  returned_orders: number;
  cancelled_orders: number;
  no_answer_orders: number;
  risk_score: number;
  last_order_at: string | null;
  orders: CustomerOrder[];
};

export function CustomersTable({ rows }: { rows: CustomerRow[] }) {
  const t = useTranslations();
  const statusLabel = useStatusLabel();

  function riskReason(r: CustomerRow) {
    const parts = [];
    if (r.returned_orders) parts.push(`${r.returned_orders} ${statusLabel("delivery", "returned", t("status.delivery_status.returned"))}`);
    if (r.cancelled_orders) parts.push(`${r.cancelled_orders} ${statusLabel("confirmation", "cancelled", t("status.confirmation_status.cancelled"))}`);
    if (r.no_answer_orders) parts.push(`${r.no_answer_orders} ${statusLabel("confirmation", "no_answer", t("status.confirmation_status.no_answer"))}`);
    return parts.join(" · ") || undefined;
  }

  const columns: Column<CustomerRow>[] = [
    {
      id: "name",
      header: t("fields.name"),
      sortable: true,
      sticky: true,
      cell: (r) => <span className="font-medium">{r.name}</span>,
    },
    {
      id: "phone",
      header: t("fields.phone"),
      cell: (r) => (
        <PhoneLinks phone={r.phone} callLabel={t("orders.call")} waLabel={t("orders.whatsapp")} />
      ),
    },
    { id: "wilaya", header: t("fields.wilaya"), cell: (r) => r.wilaya_name ?? "—" },
    { id: "total_orders", header: t("common.total"), numeric: true, sortable: true, cell: (r) => r.total_orders },
    { id: "delivered", header: statusLabel("delivery", "delivered", t("status.delivery_status.delivered")), numeric: true, cell: (r) => r.delivered_orders },
    { id: "returned", header: statusLabel("delivery", "returned", t("status.delivery_status.returned")), numeric: true, cell: (r) => r.returned_orders },
    {
      id: "delivery_rate",
      header: t("fields.deliveryRate"),
      cell: (r) => {
        const rate = customerDeliveryRate(r);
        return rate ? <RateCell pct={rate.pct} label={rate.label} labelWidth="w-16" /> : "—";
      },
    },
    {
      id: "risk",
      header: t("fields.risk"),
      align: "center",
      sortable: true,
      cell: (r) => <RiskBadge score={r.risk_score} reason={riskReason(r)} />,
    },
    {
      id: "last_order",
      header: t("fields.lastOrder"),
      sortable: true,
      defaultHidden: true,
      cell: (r) => (r.last_order_at ? formatDate(r.last_order_at) : "—"),
    },
  ];

  return (
    <DataTable<CustomerRow>
      tableId="contacts-customers"
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      empty={{ title: t("contacts.customersNone") }}
      renderSheet={(r) => ({
        title: (
          <span className="flex items-center gap-2">
            {r.name}
            <Link href={`/app/sell/customers/${r.id}`} className="text-info hover:underline" aria-label={t("orders.openFull")}>
              <ExternalLink className="h-4 w-4" />
            </Link>
          </span>
        ),
        body: (
          <div className="space-y-5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <RiskBadge score={r.risk_score} reason={riskReason(r)} size="md" />
            </div>

            <div className="space-y-1">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("fields.phone")}</div>
              <PhoneLinks phone={r.phone} callLabel={t("orders.call")} waLabel={t("orders.whatsapp")} />
              <div className="text-muted-foreground">{[r.commune, r.wilaya_name].filter(Boolean).join(" · ") || "—"}</div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Stat label={t("common.total")} value={r.total_orders} />
              <Stat label={statusLabel("delivery", "delivered", t("status.delivery_status.delivered"))} value={r.delivered_orders} />
              <Stat label={statusLabel("delivery", "returned", t("status.delivery_status.returned"))} value={r.returned_orders} />
            </div>

            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("contacts.orderHistory")}</div>
              {!r.orders.length ? (
                <p className="text-sm text-muted-foreground">{t("contacts.noOrders")}</p>
              ) : (
                <ol className="space-y-3">
                  {r.orders.map((o) => {
                    const s = currentStatus(o);
                    return (
                    <li key={o.id} className="border-s-2 border-border ps-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/app/sell/orders/${o.id}`}
                          className="num font-medium hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <OrderNo seq={o.order_seq} />
                        </Link>
                        <StatusPill kind={s.kind} status={s.key} size="sm" />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {o.product_name ?? "—"} × <span className="num">{o.quantity}</span> ·{" "}
                        <span className="num">{formatCurrency((o.sale_price ?? 0) * o.quantity)}</span> ·{" "}
                        {formatDateTime(o.placed_at)}
                      </div>
                    </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>
        ),
      })}
    />
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="num text-lg font-semibold">{value}</div>
    </div>
  );
}
