import { beforeEach, describe, expect, test, vi } from "vitest";

type Rows = Record<string, unknown>;
let tables: Record<string, Rows | Rows[] | null>;
let deleteResult: { data: { id: string }[] | null; error: { message: string } | null };
let writes: { table: string; op: string }[];

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/lib/store/invalidate", () => ({ invalidateStorePublic: vi.fn() }));
vi.mock("@/lib/rbac", () => ({ requireAdminProfile: async () => ({ workspaceId: "ws-1" }) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      let op = "select";
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order", "limit"]) q[m] = () => q;
      q.maybeSingle = async () => ({ data: tables[table] ?? null, error: null });
      q.single = async () => ({ data: { id: "new-store" }, error: null });
      q.insert = () => ((op = "insert"), writes.push({ table, op }), q);
      q.update = () => ((op = "update"), writes.push({ table, op }), q);
      q.delete = () => ((op = "delete"), writes.push({ table, op }), q);
      q.then = (ok: (v: unknown) => unknown) =>
        ok(op === "delete" ? deleteResult : op === "update" ? { data: [{ id: "x" }], error: null } : { data: tables[table], error: null });
      return q;
    },
  }),
}));

import { createStore, linkPageProduct } from "./actions";

const PAGE = "11111111-1111-4111-8111-111111111111";
const PROD = "22222222-2222-4222-8222-222222222222";

describe("store actions", () => {
  beforeEach(() => {
    writes = [];
    deleteResult = { data: [{ id: "new-store" }], error: null };
    tables = {};
  });

  test("linkPageProduct to inactive or priceless product on a published page fails", async () => {
    tables = { store_pages: { status: "published" }, products: { is_active: false, sale_price: 100 } };
    expect(await linkPageProduct(PAGE, PROD)).toEqual({ ok: false, error: "needs_product" });
    tables.products = { is_active: true, sale_price: null };
    expect(await linkPageProduct(PAGE, PROD)).toEqual({ ok: false, error: "needs_product" });
    expect(await linkPageProduct(PAGE, null)).toEqual({ ok: false, error: "needs_product" }); // unlink refused too
    expect(writes).toEqual([]);
    tables.products = { is_active: true, sale_price: 100 };
    expect(await linkPageProduct(PAGE, PROD)).toEqual({ ok: true, id: PAGE });
    tables.store_pages = { status: "draft" }; // a draft page may link anything or unlink
    tables.products = { is_active: false, sale_price: null };
    expect(await linkPageProduct(PAGE, null)).toEqual({ ok: true, id: PAGE });
  });

  test("createStore loser deletes its row or fails", async () => {
    const f = new FormData();
    f.set("slug", "luxe");
    f.set("name", "Luxe");
    // no existing store on the first check; the race list then shows an older store first
    let call = 0;
    Object.defineProperty(tables, "stores", { get: () => (call++ === 0 ? [] : [{ id: "older" }, { id: "new-store" }]), configurable: true, enumerable: true });
    expect(await createStore(f)).toEqual({ ok: false, error: "exists" });
    expect(writes.filter((w) => w.op === "delete")).toHaveLength(1);
    call = 0;
    deleteResult = { data: null, error: { message: "denied" } };
    expect(await createStore(f)).toEqual({ ok: false, error: "failed" });
    call = 0;
    deleteResult = { data: [], error: null };
    expect(await createStore(f)).toEqual({ ok: false, error: "failed" });
  });
});
