import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
// unstable_cache stand-in: memoise by key; a tag bust clears the map
const tagsSeen: string[][] = [];
const memo = new Map<string, unknown>();
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...a: unknown[]) => unknown, key: string[], opts?: { tags?: string[] }) => async (...a: unknown[]) => {
    tagsSeen.push(opts?.tags ?? []);
    const k = key.join("|");
    if (!memo.has(k)) memo.set(k, await fn(...a));
    return memo.get(k);
  },
}));
const lookups = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: async () => {
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order", "not", "in"]) q[m] = () => q;
    q.range = async () => ({ data: [{ slug: "luxe" }], error: null });
    q.maybeSingle = async () => (lookups(), { data: null, error: null });
    return { from: () => q };
  },
}));

import { getPublicProductPage } from "./data";

describe("public page cache", () => {
  beforeEach(() => {
    memo.clear();
    lookups.mockClear();
  });
  test("cached entries carry the store-public tag that every mutation busts", async () => {
    tagsSeen.length = 0;
    await getPublicProductPage("luxe", "abaya");
    expect(tagsSeen.length).toBeGreaterThan(0);
    for (const tags of tagsSeen) expect(tags).toContain("store-public");
  });
  test("second call within the window does not re-query; busting the tag does", async () => {
    await getPublicProductPage("luxe", "abaya");
    await getPublicProductPage("luxe", "abaya");
    expect(lookups).toHaveBeenCalledTimes(1);
    memo.clear(); // what updateTag("store-public") does to every tagged entry
    await getPublicProductPage("luxe", "abaya");
    expect(lookups).toHaveBeenCalledTimes(2);
  });
});
