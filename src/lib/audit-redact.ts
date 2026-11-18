import { createHash } from "node:crypto";

// Mirrors public.audit_redact() (00033_audit_redact.sql): second layer for rows
// written before the backfill or by other paths. Keep both in sync.
const SECRET_KEY = /(secret|token|password|passwd|api[_-]?key|apikey|authorization|signature)/i;
const SECRET_VALUE = /^(whsec_|sk_|shpss_|shpat_|Bearer )/;

const fingerprint = (s: string) => createHash("sha256").update(s, "utf8").digest("hex").slice(0, 8);
const mask = (s: string) => `[redacted:${fingerprint(s)}]`;

export function auditRedact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(auditRedact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        typeof v === "string" && v !== "" && SECRET_KEY.test(k) ? mask(v) : auditRedact(v),
      ]),
    );
  }
  if (typeof value === "string" && SECRET_VALUE.test(value)) return mask(value);
  return value;
}

/** Display form of an already-redacted value: `[redacted:ab12cd34]` → `[redacted · ab12cd34]`. */
export const REDACTED_DISPLAY = /\[redacted · [0-9a-f]{8}\]/g;
export const showRedacted = (s: string) => s.replace(/\[redacted:([0-9a-f]{8})\]/g, "[redacted · $1]");
