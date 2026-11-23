"use client";

import { useTranslations } from "next-intl";

import { Chip } from "@/components/ui/chip";
import { ButtonLink } from "@/components/button-link";
import { StatusPill } from "@/components/status-pill";
import { PhoneLinks } from "@/components/phone-links";
import { CustomerRisk, CustomerScoreCard } from "./customer-score-card";
import type { ScoreSummary } from "./_lib/customer-score";
import { DataTable } from "@/components/data-table/data-table";
import type { Column } from "@/components/data-table/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { NewOrdersPill } from "./new-orders-pill";
import { ConfirmationSheet } from "./confirmation-sheet";
import { OrderNo } from "@/components/order-no";

export type ConfRow = {
  id: string;
  order_seq: number;
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
  risk: ScoreSummary | null;
  scopedHistory: boolean;
  /** non-admin + already shipped: hide attempt logging */
  locked: boolean;
  recent: { id: string; order_seq: number; delivery_status: string; placed_at: string | null }[];
};

export function ConfirmationTable({ rows, scoreScope }: { rows: ConfRow[]; scoreScope: string | null }) {
  const t = useTranslations();
  const orderedKeys = rows.map((r) => r.id);

  const columns: Column<ConfRow>[] = [
    {
      id: "order_seq",
      header: t("orders.numberHeader"),
      sticky: true,
      cell: (r) => (
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="num font-medium"><OrderNo seq={r.order_seq} /></span>
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
          {scoreScope ? <CustomerScoreCard scope={scoreScope} orderId={r.id} name={r.customer_name} />
            : <div className="truncate">{r.customer_name ?? "—"}</div>}
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
        <CustomerRisk summary={r.risk} scoped={r.scopedHistory} />
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
          action: <ButtonLink href="/app/sell/orders/new" size="sm">{t("orders.new")}</ButtonLink>,
        }}
        renderSheet={(r) => ({
          title: <span className="num"><OrderNo seq={r.order_seq} /></span>,
          body: <ConfirmationSheet key={r.id} order={r} orderedKeys={orderedKeys} />,
        })}
      />
    </div>
  );
}
