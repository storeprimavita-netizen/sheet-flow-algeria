import { describe, expect, test, vi } from "vitest";

const updateTag = vi.fn();
vi.mock("next/cache", () => ({ updateTag: (t: string) => updateTag(t), revalidateTag: vi.fn() }));

import { invalidateStorePublic } from "./invalidate";

describe("store cache invalidation", () => {
  test("invalidateStorePublic busts store-public", () => {
    invalidateStorePublic();
    expect(updateTag).toHaveBeenCalledWith("store-public");
  });
});
