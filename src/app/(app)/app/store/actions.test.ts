import { beforeEach, describe, expect, test, vi } from "vitest";

type Rows = Record<string, unknown>;
let tables: Record<string, Rows | Rows[] | null>;
let deleteResult: { data: { id: string }[] | null; error: { message: string } | null };
let readError: { message: string } | null = null;
let updateResult: { data: { id: string }[] | null; error: { message: string } | null };
let readErrorTables: string[] | null = null;
let writes: { table: string; op: string }[];
let eqs: { table: string; op: string; col: string; val: unknown }[];

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/lib/store/invalidate", () => ({ invalidateStorePublic: vi.fn() }));
vi.mock("@/lib/rbac", () => ({ requireAdminProfile: async () => ({ workspaceId: "ws-1" }) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      let op = "select";
      const q: Record<string, unknown> = {};
      for (const m of ["select", "order", "limit"]) q[m] = () => q;
      q.eq = (col: string, val: unknown) => (eqs.push({ table, op, col, val }), q);
      q.maybeSingle = async () => {
        const err = readError && (!readErrorTables || readErrorTables.includes(table)) ? readError : null;
        return { data: err ? null : (tables[table] ?? null), error: err };
      };
      q.single = async () => ({ data: { id: "new-store" }, error: null });
      q.insert = () => ((op = "insert"), writes.push({ table, op }), q);
      q.update = () => ((op = "update"), writes.push({ table, op }), q);
      q.delete = () => ((op = "delete"), writes.push({ table, op }), q);
      q.then = (ok: (v: unknown) => unknown) =>
        ok(op === "delete" ? deleteResult : op === "update" ? updateResult : { data: tables[table], error: null });
      return q;
    },
  }),
}));

import { createStore, linkPageProduct, publishPage } from "./actions";

const PAGE = "11111111-1111-4111-8111-111111111111";
const PROD = "22222222-2222-4222-8222-222222222222";

describe("store actions", () => {
  beforeEach(() => {
    writes = [];
    eqs = [];
    deleteResult = { data: [{ id: "new-store" }], error: null };
    tables = {};
    readError = null;
    readErrorTables = null;
    updateResult = { data: [{ id: "x" }], error: null };
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

  test("linkPageProduct fails closed when the page read fails or the page is missing", async () => {
    tables = { store_pages: null, products: { is_active: true, sale_price: 100 } };
    expect(await linkPageProduct(PAGE, PROD)).toEqual({ ok: false, error: "failed" });
    tables.store_pages = { status: "published" };
    readError = { message: "boom" };
    expect(await linkPageProduct(PAGE, PROD)).toEqual({ ok: false, error: "failed" });
    expect(writes).toEqual([]);
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

  test("link guard filters on status", async () => {
    tables = { store_pages: { status: "published" }, products: { is_active: true, sale_price: 100 } };
    await linkPageProduct(PAGE, PROD);
    expect(eqs).toContainEqual({ table: "store_pages", op: "update", col: "status", val: "published" });
  });

  test("publish filters on product_id", async () => {
    tables = { store_pages: { product_id: PROD }, products: { is_active: true, sale_price: 100 } };
    expect(await publishPage(PAGE)).toEqual({ ok: true, id: PAGE });
    expect(eqs).toContainEqual({ table: "store_pages", op: "update", col: "product_id", val: PROD });
  });

  test("link guard on a draft page: unlink and inactive product are allowed", async () => {
    tables = { store_pages: { status: "draft" }, products: { is_active: false, sale_price: null } };
    expect(await linkPageProduct(PAGE, PROD)).toEqual({ ok: true, id: PAGE });
    expect(eqs).toContainEqual({ table: "store_pages", op: "update", col: "status", val: "draft" });
  });

  test("publish whose UPDATE matches zero rows reports needs_product", async () => {
    tables = { store_pages: { product_id: PROD }, products: { is_active: true, sale_price: 100 } };
    updateResult = { data: [], error: null };
    expect(await publishPage(PAGE)).toEqual({ ok: false, error: "needs_product" });
  });

  test("read errors throw instead of passing as a missing row", async () => {
    tables = { store_pages: { product_id: PROD, status: "published" }, products: { is_active: true, sale_price: 100 } };
    readError = { message: "boom" };
    readErrorTables = ["store_pages"];
    await expect(publishPage(PAGE)).rejects.toThrow(/boom/);
    readErrorTables = ["products"];
    await expect(publishPage(PAGE)).rejects.toThrow(/boom/);
    await expect(linkPageProduct(PAGE, PROD)).rejects.toThrow(/boom/);
    expect(writes).toEqual([]);
  });
});
