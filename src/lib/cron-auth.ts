import { createHash, timingSafeEqual } from "node:crypto";

/** Constant-time Bearer check. An unset secret must reject everything ("Bearer undefined" included). */
export function cronAuthorized(header: string | null, secret = process.env.CRON_SECRET): boolean {
  if (!secret || !header) return false;
  const h = (v: string) => createHash("sha256").update(v).digest();
  return timingSafeEqual(h(header), h(`Bearer ${secret}`));
}
