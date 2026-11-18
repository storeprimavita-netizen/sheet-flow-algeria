import { updateTag } from "next/cache";

/** Read-your-writes for every public store page. Server actions only (Next 16 `updateTag`). */
export function invalidateStorePublic() {
  updateTag("store-public");
}
