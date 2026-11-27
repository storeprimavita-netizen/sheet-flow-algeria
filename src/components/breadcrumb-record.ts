export type Rec = { label: string; href?: string; tail?: string };
export type StoredRec = Rec & { path: string };

/**
 * Next crumb-record state. Returns `prev` itself when nothing changed, so React
 * bails out and a re-set of the same record cannot loop.
 */
export function nextRecord(prev: StoredRec | null, rec: Rec | null, path: string): StoredRec | null {
  if (!rec) return prev === null ? prev : null;
  if (prev && prev.path === path && prev.label === rec.label && prev.href === rec.href && prev.tail === rec.tail) {
    return prev;
  }
  return { ...rec, path };
}
