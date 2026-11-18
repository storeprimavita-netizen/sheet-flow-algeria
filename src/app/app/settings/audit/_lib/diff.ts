import "server-only";
import { auditRedact, isSecretKey } from "@/lib/audit-redact";

/** `redacted` values carry only a fingerprint; the UI composes the localised pill from it. */
export type DiffValue = { text: string; redacted: boolean; fingerprint?: string };
export type DiffChange = { key: string; from: DiffValue; to: DiffValue };

const MASKED = /^\[redacted:([0-9a-f]{8})\]$/;

/** A badge is shown only when we masked it here, or the DB masked a secret-named key. */
function show(key: string, raw: unknown, safe: unknown): DiffValue {
  if (raw === undefined) return { text: "∅", redacted: false };
  if (typeof safe === "string") {
    const m = MASKED.exec(safe);
    const masked = JSON.stringify(raw) !== JSON.stringify(safe) || isSecretKey(key);
    if (m && masked) return { text: safe, redacted: true, fingerprint: m[1] };
  }
  return { text: JSON.stringify(safe), redacted: false };
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
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      changes.push({ key, from: show(key, rawOld?.[key], from), to: show(key, rawNew?.[key], to) });
    }
  }
  return changes;
}
