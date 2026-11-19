/** Delivery fee availability. Mirrors SQL `delivery_fee_for` — keep in sync. */
export type DeliveryType = "home" | "stopdesk";

export type DeliveryFeeRow = {
  home_fee: number;
  stopdesk_fee: number;
  priced: boolean;
  stopdesk_available: boolean;
};

/** Fee for a delivery type, or null when the type (or the wilaya) is unavailable. */
export function deliveryFeeFor(row: DeliveryFeeRow | null | undefined, type: DeliveryType): number | null {
  if (!row || !row.priced) return null;
  if (type === "home") return row.home_fee;
  return row.stopdesk_available ? row.stopdesk_fee : null;
}

export type OrderBlock = "stopped" | "unpriced" | "type_unavailable";

/** Why a NEW order cannot be created for this wilaya and type (null = fine). Same check client and server. */
export function newOrderBlock(
  row: (DeliveryFeeRow & { stop_shipping: boolean }) | null | undefined,
  type: DeliveryType,
): OrderBlock | null {
  if (!row) return null;
  if (row.stop_shipping) return "stopped";
  if (!row.priced) return "unpriced";
  return deliveryFeeFor(row, type) === null ? "type_unavailable" : null;
}
