/** Single rule for "may this order be sent to ZR Express" (state, not the nullable swap link). */
export type ZRSendState = { ok: true } | { ok: false; reason: "swapped" | "status" };

export function zrSendState(order: {
  swapped_to_order_id: string | null;
  delivery_status: string;
}): ZRSendState {
  // The link clears if the replacement order is deleted, so the `swap` status counts too.
  if (order.swapped_to_order_id || order.delivery_status === "swap") return { ok: false, reason: "swapped" };
  if (order.delivery_status !== "wait_for_deposit") return { ok: false, reason: "status" };
  return { ok: true };
}
