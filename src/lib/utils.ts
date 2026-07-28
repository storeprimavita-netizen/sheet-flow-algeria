import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Lowercase, accent-stripped, trimmed — for fuzzy name matching (webhook payloads, ZR Express territories). */
export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** JSON Response \u2014 the one-liner every webhook route handler ends with. */
export function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** In-memory sort for unpaginated DataTable lists, driven by the table's ?sort=/?dir= params. */
export function sortRows<T>(
  rows: T[],
  sorters: Record<string, (row: T) => string | number>,
  sortId: string | null,
  sortDir: "asc" | "desc",
): T[] {
  const key = sortId ? sorters[sortId] : undefined;
  if (!key) return rows;
  const dir = sortDir === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const av = key(a);
    const bv = key(b);
    return (av < bv ? -1 : av > bv ? 1 : 0) * dir;
  });
}
