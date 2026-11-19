import { stripEmoji } from "./url";

/** Public review name: first name + initial of the last word ("Amina Benali" -> "Amina B."). Never the full name. */
export function publicReviewName(raw: string): string {
  const words = stripEmoji(raw).split(" ").filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0];
  const initial = Array.from(words[words.length - 1])[0];
  return `${words[0]} ${initial}.`;
}

export type ReviewOrderFacts = {
  product_id: string | null;
  confirmation_status: string;
  excluded_reason: string | null;
};

/** "Order confirmed" mark: the linked order is for this product, confirmed and not excluded (test/fake). */
export function isVerifiedOrder(order: ReviewOrderFacts | null | undefined, productId: string): boolean {
  return !!order && order.product_id === productId && order.confirmation_status === "confirmed" && order.excluded_reason === null;
}
