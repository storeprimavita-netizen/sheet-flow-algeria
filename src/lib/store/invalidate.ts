import { revalidateTag, updateTag } from "next/cache";

/** Read-your-writes for every public store page. Server actions only (Next 16 `updateTag`). */
export function invalidateStorePublic() {
  updateTag("store-public");
}

/**
 * Stock changed by a DB trigger (order status, carrier sync). Usable from route handlers and
 * actions alike: stale-while-revalidate, so the next visit refreshes in the background.
 */
export function markStorePublicStale() {
  try {
    revalidateTag("store-public", "max");
  } catch {
    // outside a request scope (scripts, tests): the 120 s revalidate window still bounds staleness
  }
}
