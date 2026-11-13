"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { LayoutGrid, Table2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DeliveryTable } from "./delivery-table";
import { DeliveryKanban } from "./delivery-kanban";

export type DelivRow = {
  id: string;
  order_number: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  product_name: string | null;
  quantity: number;
  delivery_fee: number | null;
  to_collect: number;
  tracking_number: string | null;
  zr_state: string | null;
  wilaya_name: string | null;
  delivery_type: string;
  delivery_status: string;
  commune: string | null;
  placed_at: string | null;
};

/** Delivery queue: dense table by default, kanban as a URL-persisted toggle. */
export function DeliveryView({ rows, isAdmin }: { rows: DelivRow[]; isAdmin: boolean }) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const kanban = sp.get("view") === "kanban";

  function setView(v: "table" | "kanban") {
    const next = new URLSearchParams(sp.toString());
    if (v === "kanban") next.set("view", "kanban");
    else next.delete("view");
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const toggle = (
    <>
      <Button variant={kanban ? "ghost" : "outline"} size="sm" className="gap-1.5" onClick={() => setView("table")}>
        <Table2 className="h-4 w-4" />
        {t("orders.viewTable")}
      </Button>
      <Button variant={kanban ? "outline" : "ghost"} size="sm" className="gap-1.5" onClick={() => setView("kanban")}>
        <LayoutGrid className="h-4 w-4" />
        {t("orders.viewKanban")}
      </Button>
    </>
  );

  return kanban ? (
    <div className="space-y-3">
      <div className="flex gap-1">{toggle}</div>
      <DeliveryKanban rows={rows} />
    </div>
  ) : (
    <DeliveryTable rows={rows} toolbar={toggle} isAdmin={isAdmin} />
  );
}
