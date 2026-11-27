/** Paging for long lists: the API returns at most 1,000 rows per request. */
export const PAGE_SIZE = 25;
const BATCH = 1000;

type Result<T> = {
  data: T[] | null;
  error: { message: string; code?: string } | null;
  count?: number | null;
};
type Read<T> = (from: number, to: number) => PromiseLike<Result<T>>;

/** `?page=` value: a positive integer, anything else means 1. */
export function parsePage(value: unknown): number {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : 1;
}

/** Inclusive `[from, to]` offsets for `.range()`. */
export function pageRange(page: number): [number, number] {
  return [(page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1];
}

export function lastPage(count: number): number {
  return Math.max(1, Math.ceil(count / PAGE_SIZE));
}

/** The current URL with one page param replaced (other params kept). */
export function pageHref(
  pathname: string,
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
  page: number,
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    for (const value of [v ?? []].flat()) params.append(k, value);
  }
  params.set(key, String(page));
  return `${pathname}?${params.toString()}`;
}

/**
 * Every row of a query, batch by batch. The query must have a stable (id) order.
 * Stops on an empty batch, so a server cap below 1,000 cannot truncate it.
 * Throws on any failed batch: a partial list is never returned.
 */
export async function fetchAll<T>(batch: Read<T>): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const { data, error } = await batch(rows.length, rows.length + BATCH - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) return rows;
    rows.push(...data);
  }
}

/**
 * One page of a `count: "exact"` query. `goTo` is set when the page is past the
 * end (the API answers that with PGRST103, not an empty list): redirect there.
 */
export async function readPage<T>(
  page: number,
  read: Read<T>,
): Promise<{ rows: T[]; total: number; goTo?: number }> {
  const { data, error, count } = await read(...pageRange(page));
  if (error && error.code !== "PGRST103") throw new Error(error.message);
  if (!error && (page === 1 || data?.length)) return { rows: data ?? [], total: count ?? 0 };

  const probe = await read(0, 0);
  if (probe.error) throw new Error(probe.error.message);
  const total = probe.count ?? 0;
  const last = lastPage(total);
  return { rows: [], total, goTo: last < page ? last : undefined };
}
