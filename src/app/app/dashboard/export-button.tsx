"use client";

import { useTranslations } from "next-intl";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toCSV, downloadCSV, type CsvColumn } from "@/lib/csv";

export type OrderExportRow = {
  order_number: string | null;
  placed_at: string | null;
  customer_name: string | null;
  product_name: string | null;
  wilaya_name: string | null;
  quantity: number;
  total_dzd: number;
  confirmation_status: string;
  delivery_status: string;
};

const ORDER_COLS: CsvColumn<OrderExportRow>[] = [
  { key: "order_number", label: "Order", value: (r) => r.order_number ?? "" },
  { key: "placed_at", label: "Placed", value: (r) => r.placed_at ?? "" },
  { key: "customer", label: "Customer", value: (r) => r.customer_name ?? "" },
  { key: "product", label: "Product", value: (r) => r.product_name ?? "" },
  { key: "wilaya", label: "Wilaya", value: (r) => r.wilaya_name ?? "" },
  { key: "quantity", label: "Qty", value: (r) => r.quantity },
  { key: "total_dzd", label: "Total (DZD)", value: (r) => r.total_dzd },
  { key: "confirmation_status", label: "Confirmation", value: (r) => r.confirmation_status },
  { key: "delivery_status", label: "Delivery", value: (r) => r.delivery_status },
];

const SUMMARY_COLS: CsvColumn<{ label: string; value: string | number }>[] = [
  { key: "label", label: "Metric", value: (r) => r.label },
  { key: "value", label: "Value", value: (r) => r.value },
];

export function DashboardExportButtons({
  orders,
  summary,
}: {
  orders: OrderExportRow[];
  summary: { label: string; value: string | number }[];
}) {
  const t = useTranslations();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-semibold">{t("dashboard.export.title")}</span>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => downloadCSV("orders.csv", toCSV(ORDER_COLS, orders))}
      >
        <Download className="h-4 w-4" />
        {t("dashboard.export.orders")} ({orders.length})
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => downloadCSV("summary.csv", toCSV(SUMMARY_COLS, summary))}
      >
        <Download className="h-4 w-4" />
        {t("dashboard.export.summary")}
      </Button>
    </div>
  );
}
