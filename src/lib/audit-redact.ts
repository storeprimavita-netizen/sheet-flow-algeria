import "server-only";
import { createHash } from "node:crypto";

// Mirrors public.audit_redact() (00033_audit_redact.sql): second layer for rows
// written before the backfill or by other paths. Keep both in sync.
const SECRET_KEY =
  /^(secret|secrets|token|tokens|password|passwd|api[_-]?keys?|authorization|signature|(access|refresh|api|auth|bot|webhook|client|private)[_-](token|secret|key))$/i;
// `settings` rows are {key, value}: the value is secret when the key name ends so.
const SECRET_NAME = /(secret|token|password|passwd|api[_-]?key|authorization|signature)$/i;
const SECRET_VALUE = /^(whsec_|sk_|shpss_|shpat_|Bearer )/;
const MASKED = /^\[redacted:[0-9a-f]{8}\]$/;

const fingerprint = (s: string) => createHash("sha256").update(s, "utf8").digest("hex").slice(0, 8);
const mask = (s: string) => `[redacted:${fingerprint(s)}]`;

export function auditRedact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(auditRedact);
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    const isKv = typeof o.key === "string" && SECRET_NAME.test(o.key);
    return Object.fromEntries(
      Object.entries(o).map(([k, v]) => {
        const secretKey = SECRET_KEY.test(k) || (isKv && k === "value");
        if (!secretKey || v === null || v === undefined) return [k, auditRedact(v)];
        if (typeof v === "string") return [k, v === "" || MASKED.test(v) ? v : mask(v)];
        return [k, mask(JSON.stringify(v))];
      }),
    );
  }
  if (typeof value === "string" && SECRET_VALUE.test(value)) return mask(value);
  return value;
}
