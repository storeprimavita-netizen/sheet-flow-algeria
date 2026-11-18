import "server-only";
import { createHash } from "node:crypto";

// Mirrors public.audit_redact() (00036_audit_redact_acronyms.sql, D49). Keep both in sync.
// Run-together forms (apikey, secretkey, accesstoken, authtoken, privatekey, clientsecret, webhooksecret, bottoken) are listed explicitly (D49).
// A name is secret if either normalisation is secret and not allow-listed:
//  a) trim spaces, split acronyms (XAPIKey) and camelCase, separators to "_", lowercase, trim "_";
//  b) case-only (lowercase, separators to "_", trim "_") which catches sEcReT.
const SECRET_KEY = /(^|_)(keys?|tokens?|secrets?|password|passwd|pwd|passphrase|credentials?|authorization|signature|apikeys?|secretkey|accesstoken|authtoken|privatekey|clientsecret|webhooksecret|bottoken)$/;
const ALLOW_KEY = /^(keys?|idempotency_key|sort_key|cache_key|(color|design|theme)_tokens?)$/;
const sep = (k: string) => k.replace(/[-. :]/g, "_");
const trimUnderscore = (k: string) => k.replace(/^_+|_+$/g, "");
const normKey = (k: string) =>
  trimUnderscore(sep(k.replace(/^ +| +$/g, "").replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2").replace(/([a-z0-9])([A-Z])/g, "$1_$2")).toLowerCase());
const normCase = (k: string) => trimUnderscore(sep(k.replace(/^ +| +$/g, "")).toLowerCase());
export const isSecretKey = (k: string) => [normKey(k), normCase(k)].some((n) => SECRET_KEY.test(n) && !ALLOW_KEY.test(n));
export const MAX_DEPTH = 64;
const SECRET_VALUE = /^(whsec_|sk_|shpss_|shpat_|Bearer )/;
const MASKED = /^\[redacted:[0-9a-f]{8}\]$/;

const fingerprint = (s: string) => createHash("sha256").update(s, "utf8").digest("hex").slice(0, 8);
const mask = (s: string) => `[redacted:${fingerprint(s)}]`;

/** Text of a value as Postgres jsonb prints it (keys by UTF-8 byte length then bytes, ": " and ", "). */
export function jsonbText(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(jsonbText).join(", ")}]`;
  if (v && typeof v === "object") {
    const keys = Object.keys(v).sort((a, b) => Buffer.byteLength(a) - Buffer.byteLength(b) || Buffer.compare(Buffer.from(a), Buffer.from(b)));
    return `{${keys.map((k) => `${JSON.stringify(k)}: ${jsonbText((v as Record<string, unknown>)[k])}`).join(", ")}}`;
  }
  return JSON.stringify(v);
}

export function auditRedact(value: unknown, depth = 0): unknown {
  if (value !== null && value !== undefined && depth > MAX_DEPTH) return mask(jsonbText(value));
  if (Array.isArray(value)) return value.map((e) => auditRedact(e, depth + 1));
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    const isKv = typeof o.key === "string" && isSecretKey(o.key);
    return Object.fromEntries(
      Object.entries(o).map(([k, v]) => {
        const secretKey = isSecretKey(k) || (isKv && k === "value");
        if (!secretKey || v === null || v === undefined) return [k, auditRedact(v, depth + 1)];
        if (typeof v === "string") return [k, v === "" || MASKED.test(v) ? v : mask(v)];
        return [k, mask(jsonbText(v))];
      }),
    );
  }
  if (typeof value === "string" && SECRET_VALUE.test(value)) return mask(value);
  return value;
}
