"use client";

import { useTranslations } from "next-intl";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toCSV, downloadCSV, type CsvColumn } from "@/lib/csv";

export type OrderExport = {
  order_number: string | null;
  placed_at: string | null;
  customer_name: string | null;
  product_name: string | null;
  quantity: number;
  total_amount: number | null;
  confirmation_status: string;
  delivery_status: string;
};

export type ExpenseExport = {
  incurred_on: string;
  category: string;
  amount: number;
  product_name: string | null;
  order_number: string | null;
  notes: string | null;
};

export type CashExport = {
  collected_at: string;
  order_number: string | null;
  amount: number;
  collected_by: string | null;
  status: string;
  deposit_reference: string | null;
  deposited_at: string | null;
};

const ORDER_COLS: CsvColumn<OrderExport>[] = [
  { key: "order_number", label: "Order", value: (r) => r.order_number ?? "" },
  { key: "placed_at", label: "Placed", value: (r) => r.placed_at ?? "" },
  { key: "customer", label: "Customer", value: (r) => r.customer_name ?? "" },
  { key: "product", label: "Product", value: (r) => r.product_name ?? "" },
  { key: "quantity", label: "Qty", value: (r) => r.quantity },
  { key: "total_amount", label: "Total", value: (r) => r.total_amount ?? 0 },
  { key: "confirmation_status", label: "Confirmation", value: (r) => r.confirmation_status },
  { key: "delivery_status", label: "Delivery", value: (r) => r.delivery_status },
];

const EXPENSE_COLS: CsvColumn<ExpenseExport>[] = [
  { key: "incurred_on", label: "Date", value: (r) => r.incurred_on },
  { key: "category", label: "Category", value: (r) => r.category },
  { key: "amount", label: "Amount", value: (r) => r.amount },
  { key: "product", label: "Product", value: (r) => r.product_name ?? "" },
  { key: "order", label: "Order", value: (r) => r.order_number ?? "" },
  { key: "notes", label: "Notes", value: (r) => r.notes ?? "" },
];

const CASH_COLS: CsvColumn<CashExport>[] = [
  { key: "collected_at", label: "Collected", value: (r) => r.collected_at },
  { key: "order_number", label: "Order", value: (r) => r.order_number ?? "" },
  { key: "amount", label: "Amount", value: (r) => r.amount },
  { key: "collected_by", label: "Collected by", value: (r) => r.collected_by ?? "" },
  { key: "status", label: "Status", value: (r) => r.status },
  { key: "deposit_reference", label: "Deposit ref", value: (r) => r.deposit_reference ?? "" },
  { key: "deposited_at", label: "Deposited", value: (r) => r.deposited_at ?? "" },
];

export function ReportsExporter({
  orders,
  expenses,
  cash,
}: {
  orders: OrderExport[];
  expenses: ExpenseExport[];
  cash: CashExport[];
}) {
  const t = useTranslations();

  return (
    <div className="glass-card flex flex-wrap items-center gap-3 rounded-xl p-4">
      <span className="text-sm font-semibold">{t("reports.export")}</span>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => downloadCSV("orders.csv", toCSV(ORDER_COLS, orders))}
      >
        <Download className="h-4 w-4" />
        {t("reports.exportOrders")} ({orders.length})
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => downloadCSV("expenses.csv", toCSV(EXPENSE_COLS, expenses))}
      >
        <Download className="h-4 w-4" />
        {t("reports.exportExpenses")} ({expenses.length})
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => downloadCSV("cash.csv", toCSV(CASH_COLS, cash))}
      >
        <Download className="h-4 w-4" />
        {t("reports.exportCash")} ({cash.length})
      </Button>
    </div>
  );
}
