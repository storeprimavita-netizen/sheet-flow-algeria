import "server-only";
import { auditRedact, isSecretKey } from "@/lib/audit-redact";

/** `redacted` values carry only a fingerprint; the UI composes the localised pill from it. */
export type DiffValue = { text: string; redacted: boolean; fingerprint?: string };
export type DiffChange = { key: string; from: DiffValue; to: DiffValue };

const MASKED = /^\[redacted:([0-9a-f]{8})\]$/;

type Leaf = { raw: unknown; safe: unknown; secret: boolean };
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Flatten nested objects to dotted paths so every leaf gets its own secret/redacted check. */
function flatten(raw: unknown, safe: unknown, path: string, secret: boolean, out: Map<string, Leaf>) {
  if (isObj(safe) && isObj(raw)) {
    const kvSecret = typeof raw.key === "string" && isSecretKey(raw.key);
    for (const k of Object.keys(safe)) {
      flatten(raw[k], safe[k], path ? `${path}.${k}` : k, isSecretKey(k) || (kvSecret && k === "value"), out);
    }
    if (Object.keys(safe).length > 0) return;
  }
  out.set(path, { raw, safe, secret });
}

/** A badge is shown only when we masked it here, or the DB masked a secret-named key. */
function show(leaf: Leaf | undefined): DiffValue {
  if (!leaf || leaf.raw === undefined) return { text: "∅", redacted: false };
  const { raw, safe, secret } = leaf;
  if (typeof safe === "string") {
    const m = MASKED.exec(safe);
    if (m && (JSON.stringify(raw) !== JSON.stringify(safe) || secret)) return { text: safe, redacted: true, fingerprint: m[1] };
  }
  return { text: JSON.stringify(safe), redacted: false };
}

function leaves(raw: Record<string, unknown> | null, safe: Record<string, unknown> | null) {
  const out = new Map<string, Leaf>();
  if (raw && safe) flatten(raw, safe, "", false, out);
  out.delete("");
  return out;
}

/** Redacted, display-ready diff of an audit row. Redaction happens here, on the server. */
export function diffRows(rawOld: Record<string, unknown> | null, rawNew: Record<string, unknown> | null): DiffChange[] {
  const o = leaves(rawOld, auditRedact(rawOld) as Record<string, unknown> | null);
  const n = leaves(rawNew, auditRedact(rawNew) as Record<string, unknown> | null);
  const changes: DiffChange[] = [];
  for (const key of new Set([...o.keys(), ...n.keys()])) {
    if (key === "updated_at" || key === "created_at") continue;
    const from = o.get(key);
    const to = n.get(key);
    if (JSON.stringify(from?.safe) !== JSON.stringify(to?.safe)) changes.push({ key, from: show(from), to: show(to) });
  }
  return changes;
}
