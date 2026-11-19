import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, test, vi } from "vitest";

import type { Database } from "@/lib/supabase/database.types";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
const admin = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => admin() }));

import { getPublicProductPage, loadPublicProductPage } from "./data";

// every query resolves to a failed result: a DB error must throw, never read as "not found"
function failingDb(): SupabaseClient<Database> {
  const result = { data: null, error: { message: "boom" } };
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "not", "in"]) q[m] = () => q;
  q.maybeSingle = () => Promise.resolve(result);
  return { from: () => q } as unknown as SupabaseClient<Database>;
}

describe("public DAL errors", () => {
  test("a DB error throws so it is never cached as a 404", async () => {
    await expect(loadPublicProductPage(failingDb(), "luxe", "abaya")).rejects.toThrow(/store lookup failed/);
  });

  test("liveStoreSlugs paginates past 1000 and throws on error", async () => {
    const ranges: number[] = [];
    const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ slug: `S${i}` }));
    const db = (fail: boolean) => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order"]) q[m] = () => q;
      q.range = (from: number) => {
        ranges.push(from);
        if (fail) return Promise.resolve({ data: null, error: { message: "boom" } });
        return Promise.resolve({ data: from === 0 ? rows(1000) : rows(5), error: null });
      };
      return { from: () => q };
    };
    admin.mockResolvedValue(db(false));
    // slug beyond the first page is still found as live (it then 404s later on the page lookup, not on the slug gate)
    await getPublicProductPage("s1004", "abaya").catch(() => null);
    expect(ranges).toEqual([0, 1000]);
    admin.mockResolvedValue(db(true));
    await expect(getPublicProductPage("s1", "abaya")).rejects.toThrow(/live stores lookup failed/);
  });
});
