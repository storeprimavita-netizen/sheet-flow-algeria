import "server-only";
import { createHash } from "node:crypto";

// Mirrors public.audit_redact() (00033_audit_redact.sql): second layer for rows
// written before the backfill or by other paths. Keep both in sync.
// Keys are normalised (camelCase and '-' to snake_case, lowercase) and masked when
// they END in a secret word as a whole snake segment; ALLOW keeps safe names.
const SECRET_KEY = /(^|_)(secrets?|tokens?|password|passwd|pwd|credentials?|authorization|signature|apikeys?|api_keys?|access_keys?|private_keys?)$/;
const ALLOW_KEY = /^(color|design|theme)_tokens?$/;
const normKey = (k: string) => k.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/-/g, "_").toLowerCase();
const isSecretKey = (k: string) => {
  const n = normKey(k);
  return SECRET_KEY.test(n) && !ALLOW_KEY.test(n);
};
const SECRET_VALUE = /^(whsec_|sk_|shpss_|shpat_|Bearer )/;
const MASKED = /^\[redacted:[0-9a-f]{8}\]$/;

const fingerprint = (s: string) => createHash("sha256").update(s, "utf8").digest("hex").slice(0, 8);
const mask = (s: string) => `[redacted:${fingerprint(s)}]`;

export function auditRedact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(auditRedact);
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    const isKv = typeof o.key === "string" && isSecretKey(o.key);
    return Object.fromEntries(
      Object.entries(o).map(([k, v]) => {
        const secretKey = isSecretKey(k) || (isKv && k === "value");
        if (!secretKey || v === null || v === undefined) return [k, auditRedact(v)];
        if (typeof v === "string") return [k, v === "" || MASKED.test(v) ? v : mask(v)];
        return [k, mask(JSON.stringify(v))];
      }),
    );
  }
  if (typeof value === "string" && SECRET_VALUE.test(value)) return mask(value);
  return value;
}
