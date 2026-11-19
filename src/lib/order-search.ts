import { z } from "zod";

const SEQ_QUERY = z.string().regex(/^#?\d{1,9}$/);

/** `#0042`, `42`, `0042` -> 42; anything else (names, phones with spaces, 10+ digits) -> null. */
export function parseOrderSeqQuery(q: string): number | null {
  const m = SEQ_QUERY.safeParse(q.trim());
  return m.success ? Number(m.data.replace("#", "")) : null;
}

/** Free-text part of the orders search, safe inside a PostgREST `.or()` filter string. */
export function sanitizeOrderTextQuery(q: string): string {
  return q.replace(/[,()*%\\"':]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}
