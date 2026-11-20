import { beforeEach, describe, expect, test, vi } from "vitest";

const ID = "11111111-1111-4111-8111-111111111111";
let tables: Record<string, { data: unknown; error: { message: string } | null }>;

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (k: string) => k }));
vi.mock("@/components/store/product-view", () => ({ ProductView: () => null }));
vi.mock("@/components/store/store.css", () => ({}));
vi.mock("@/components/button-link", () => ({ ButtonLink: () => null }));
vi.mock("@/lib/store/data", () => ({ assembleProductPage: async () => ({}) }));
vi.mock("../../../_lib/data", () => ({ requireStoreAdmin: async () => ({}) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.eq = () => q;
      q.maybeSingle = async () => tables[table];
      return q;
    },
  }),
}));

import StorePagePreview from "./page";

const ok = (data: unknown) => ({ data, error: null });
const run = (id = ID) => StorePagePreview({ params: Promise.resolve({ id }) });

describe("store page preview", () => {
  beforeEach(() => {
    tables = {
      store_pages: ok({ id: ID, store_id: "s", product_id: "p", slug: "x", title: "T", blocks: [], seo: {} }),
      stores: ok({ id: "s" }),
      products: ok({ id: "p" }),
    };
  });

  test("renders for a readable page", async () => {
    await expect(run()).resolves.toBeTruthy();
  });

  test("unknown or malformed id is a 404", async () => {
    tables.store_pages = ok(null);
    await expect(run()).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(run("nope")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  test("a read error on any table throws instead of passing as a 404", async () => {
    for (const table of ["store_pages", "stores", "products"]) {
      beforeEachReset();
      tables[table] = { data: null, error: { message: `boom-${table}` } };
      await expect(run()).rejects.toThrow(/boom/);
    }
  });
});

function beforeEachReset() {
  tables = {
    store_pages: ok({ id: ID, store_id: "s", product_id: "p", slug: "x", title: "T", blocks: [], seo: {} }),
    stores: ok({ id: "s" }),
    products: ok({ id: "p" }),
  };
}
