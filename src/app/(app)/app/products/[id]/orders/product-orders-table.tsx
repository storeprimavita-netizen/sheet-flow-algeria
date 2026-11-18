"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { formatCurrency, formatDate } from "@/lib/format";
import { StatusPill } from "@/components/status-pill";
import { currentStatus } from "@/lib/statuses";
import { DataTable } from "@/components/data-table/data-table";
import type { Column } from "@/components/data-table/types";
import { OrderNo } from "@/components/order-no";

export type ProductOrderRow = {
  id: string;
  order_seq: number;
  placed_at: string | null;
  customer_name: string | null;
  quantity: number;
  sale_price: number | null;
  confirmation_status: string;
  delivery_status: string;
};

export function ProductOrdersTable({ rows }: { rows: ProductOrderRow[] }) {
  const t = useTranslations();

  const columns: Column<ProductOrderRow>[] = [
    {
      id: "order_seq",
      header: t("orders.numberHeader"),
      sticky: true,
      cell: (r) => (
        <Link href={`/app/orders/${r.id}`} className="num font-medium hover:underline">
          <OrderNo seq={r.order_seq} />
        </Link>
      ),
    },
    { id: "placed_at", header: t("fields.placed_at"), cell: (r) => formatDate(r.placed_at) },
    { id: "customer", header: t("fields.customer"), cell: (r) => r.customer_name ?? "—" },
    { id: "quantity", header: t("fields.quantity"), numeric: true, cell: (r) => <span className="num">{r.quantity}</span> },
    { id: "total", header: t("fields.total_amount"), numeric: true, cell: (r) => formatCurrency((r.sale_price ?? 0) * r.quantity) },
    {
      id: "status",
      header: t("fields.status"),
      align: "center",
      cell: (r) => {
        const s = currentStatus(r);
        return <StatusPill kind={s.kind} status={s.key} size="sm" />;
      },
    },
  ];

  return (
    <DataTable<ProductOrderRow>
      tableId="product-orders"
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      defaultDensity="compact"
      empty={{ title: t("orders.none"), description: t("products.ordersEmptyHint") }}
    />
  );
}
