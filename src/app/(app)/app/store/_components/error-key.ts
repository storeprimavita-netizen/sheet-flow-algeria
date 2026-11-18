import type { StoreResult } from "../actions";

/** Message key (under store.admin.hub) for a failed store action. */
export function hubErrorKey(r: Extract<StoreResult, { ok: false }>): "exists" | "slugTaken" | "invalid" | "failed" {
  if (r.error === "exists") return "exists";
  if (r.error === "slug_taken") return "slugTaken";
  if (r.error === "invalid") return "invalid";
  return "failed";
}
