import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, test, vi } from "vitest";

import type { Database } from "@/lib/supabase/database.types";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

import { loadPublicProductPage } from "./data";

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
});
