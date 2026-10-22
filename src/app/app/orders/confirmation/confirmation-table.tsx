"use client";

import { useTranslations } from "next-intl";

import { Chip } from "@/components/ui/chip";
import { ButtonLink } from "@/components/button-link";
import { StatusPill } from "@/components/status-pill";
import { PhoneLinks } from "@/components/phone-links";
import { RiskBadge } from "@/components/risk-badge";
import { DataTable } from "@/components/data-table/data-table";
import type { Column } from "@/components/data-table/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { NewOrdersPill } from "./new-orders-pill";
import { ConfirmationSheet } from "./confirmation-sheet";

export type ConfRow = {
  id: string;
  order_number: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  product_name: string | null;
  quantity: number;
  sale_price: number | null;
  confirmation_status: string;
  confirmation_comment: string | null;
  confirmation_attempts: number;
  commune: string | null;
  placed_at: string | null;
  is_duplicate_suspect: boolean;
  duplicate_of: string | null;
  risk_score: number;
  risk_reason: string;
  delivery_rate: string;
  /** non-admin + already shipped: hide attempt logging */
  locked: boolean;
  recent: { id: string; order_number: string | null; delivery_status: string; placed_at: string | null }[];
};

export function ConfirmationTable({ rows }: { rows: ConfRow[] }) {
  const t = useTranslations();
  const orderedKeys = rows.map((r) => r.id);

  const columns: Column<ConfRow>[] = [
    {
      id: "order_number",
      header: t("orders.title"),
      sticky: true,
      cell: (r) => (
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="num font-medium">{r.order_number ?? r.id.slice(0, 8)}</span>
          {r.is_duplicate_suspect ? (
            <Chip token="danger" size="sm">
              {t("orders.duplicate")}
            </Chip>
          ) : null}
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
    { id: "total", header: t("fields.total_amount"), numeric: true, cell: (r) => formatCurrency((r.sale_price ?? 0) * r.quantity) },
    {
      id: "risk",
      header: t("fields.risk"),
      align: "center",
      cell: (r) => (
        <div className="space-y-0.5">
          <RiskBadge score={r.risk_score} reason={r.risk_reason} />
          <div className="num text-xs text-muted-foreground">{r.delivery_rate}</div>
        </div>
      ),
    },
    {
      id: "status",
      header: t("fields.confirmation_status"),
      align: "center",
      cell: (r) => <StatusPill kind="confirmation" status={r.confirmation_status} size="sm" />,
    },
    { id: "placed_at", header: t("fields.placed_at"), cell: (r) => formatDate(r.placed_at) },
  ];

  return (
    <div className="space-y-3">
      <NewOrdersPill />
      <DataTable<ConfRow>
        tableId="orders-confirmation"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        empty={{
          title: t("orders.none"),
          description: t("orders.confirmationEmptyHint"),
          action: <ButtonLink href="/app/orders/new" size="sm">{t("orders.new")}</ButtonLink>,
        }}
        renderSheet={(r) => ({
          title: <span className="num">{r.order_number ?? r.id.slice(0, 8)}</span>,
          body: <ConfirmationSheet key={r.id} order={r} orderedKeys={orderedKeys} />,
        })}
      />
    </div>
  );
}
