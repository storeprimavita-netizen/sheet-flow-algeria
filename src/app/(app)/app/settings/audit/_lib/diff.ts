import "server-only";
import { auditRedact } from "@/lib/audit-redact";

/** `redacted` values carry only a fingerprint; the UI composes the localised pill from it. */
export type DiffValue = { text: string; redacted: boolean; fingerprint?: string };
/** `id` is unique per path (React key); `key` is display only (segments joined by " › "; array indices are numbers in the id so they never collide with object keys; "" = empty key, the UI labels it). */
export type DiffChange = { id: string; key: string; from: DiffValue; to: DiffValue };

const MASKED = /^\[redacted:([0-9a-f]{8})\]$/;
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

type Leaf = { segments: (string | number)[]; safe: unknown };

/** Flatten objects and arrays to path segments so every leaf is compared (and shown) on its own. */
function flatten(safe: unknown, segments: (string | number)[], out: Map<string, Leaf>) {
  if (isObj(safe)) {
    const keys = Object.keys(safe);
    for (const k of keys) flatten(safe[k], [...segments, k], out);
    if (keys.length > 0 || segments.length === 0) return;
  } else if (Array.isArray(safe) && safe.length > 0) {
    safe.forEach((e, i) => flatten(e, [...segments, i], out));
    return;
  }
  out.set(JSON.stringify(segments), { segments, safe });
}

/** A pill is shown for any value that is a mask token (DB-masked secret, or masked at the depth cap). */
function show(leaf: Leaf | undefined): DiffValue {
  if (!leaf) return { text: "∅", redacted: false };
  const { safe } = leaf;
  if (typeof safe === "string") {
    const m = MASKED.exec(safe);
    if (m) return { text: safe, redacted: true, fingerprint: m[1] };
  }
  return { text: JSON.stringify(safe), redacted: false };
}

function leaves(safe: Record<string, unknown> | null) {
  const out = new Map<string, Leaf>();
  if (safe) flatten(safe, [], out);
  return out;
}

const isTimestamp = (s: (string | number)[]) => s.length === 1 && (s[0] === "updated_at" || s[0] === "created_at");

/** Redacted, display-ready diff of an audit row. Redaction happens here, on the server. */
export function diffRows(rawOld: Record<string, unknown> | null, rawNew: Record<string, unknown> | null): DiffChange[] {
  const o = leaves(auditRedact(rawOld) as Record<string, unknown> | null);
  const n = leaves(auditRedact(rawNew) as Record<string, unknown> | null);
  const changes: DiffChange[] = [];
  for (const id of new Set([...o.keys(), ...n.keys()])) {
    const from = o.get(id);
    const to = n.get(id);
    const segments = (from ?? to)!.segments;
    if (isTimestamp(segments)) continue;
    if (JSON.stringify(from?.safe) !== JSON.stringify(to?.safe)) changes.push({ id, key: segments.join(" › "), from: show(from), to: show(to) });
  }
  return changes;
}
