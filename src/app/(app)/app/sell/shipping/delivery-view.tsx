import type { ViewLayout } from "@/lib/order-views";
import type { SwapTo } from "../orders/_lib/swap-links";
import { DeliveryTable } from "./delivery-table";
import { DeliveryKanban } from "./delivery-kanban";

export type DelivRow = {
  id: string;
  order_seq: number;
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
  swapped_to: SwapTo | null;
};

/** Delivery queue with the resolved view layout. */
export function DeliveryView({ rows, isAdmin, layout }: { rows: DelivRow[]; isAdmin: boolean; layout: ViewLayout }) {
  return layout === "kanban" ? <DeliveryKanban rows={rows} /> : <DeliveryTable rows={rows} isAdmin={isAdmin} />;
}
