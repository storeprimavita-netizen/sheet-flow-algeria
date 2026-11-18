import "server-only";
import { auditRedact } from "@/lib/audit-redact";

export type DiffValue = { text: string; redacted: boolean };
export type DiffChange = { key: string; from: DiffValue; to: DiffValue };

const MASKED = /^\[redacted:([0-9a-f]{8})\]$/;

function show(v: unknown): DiffValue {
  if (v === undefined) return { text: "∅", redacted: false };
  if (typeof v === "string") {
    const m = MASKED.exec(v);
    if (m) return { text: `[redacted · ${m[1]}]`, redacted: true };
  }
  return { text: JSON.stringify(v), redacted: false };
}

/** Redacted, display-ready diff of an audit row. Redaction happens here, on the server. */
export function diffRows(rawOld: Record<string, unknown> | null, rawNew: Record<string, unknown> | null): DiffChange[] {
  const oldRow = auditRedact(rawOld) as Record<string, unknown> | null;
  const newRow = auditRedact(rawNew) as Record<string, unknown> | null;
  const keys = new Set([...Object.keys(oldRow ?? {}), ...Object.keys(newRow ?? {})]);
  const changes: DiffChange[] = [];
  for (const key of keys) {
    if (key === "updated_at" || key === "created_at") continue;
    const from = oldRow?.[key];
    const to = newRow?.[key];
    if (JSON.stringify(from) !== JSON.stringify(to)) changes.push({ key, from: show(from), to: show(to) });
  }
  return changes;
}
