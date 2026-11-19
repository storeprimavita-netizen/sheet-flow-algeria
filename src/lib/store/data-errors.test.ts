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
    let fromCalls = 0;
    const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ slug: `S${i}` }));
    const db = (fail: boolean) => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order"]) q[m] = () => q;
      q.range = (from: number) => {
        ranges.push(from);
        if (fail) return Promise.resolve({ data: null, error: { message: "boom" } });
        return Promise.resolve({ data: from === 0 ? rows(1000) : [{ slug: "only-page-two" }], error: null });
      };
      return { from: () => (fromCalls++, q) };
    };
    admin.mockResolvedValue(db(false));
    // a slug that exists only on page 2 must pass the live-store gate (so the page lookup runs)
    await getPublicProductPage("only-page-two", "abaya").catch(() => null);
    expect(ranges).toEqual([0, 1000]);
    expect(fromCalls).toBe(3); // 2 slug pages, then the page lookup runs: the slug was found on page 2
    admin.mockResolvedValue(db(true));
    await expect(getPublicProductPage("s1", "abaya")).rejects.toThrow(/live stores lookup failed/);
  });
});
