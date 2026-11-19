import { beforeEach, describe, expect, test, vi } from "vitest";

let admin = true;
let order: Record<string, unknown> | null;
let affected: { id: string }[];
let writes: { table: string; op: string; row?: Record<string, unknown> }[];
const invalidate = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/lib/store/invalidate", () => ({ invalidateStorePublic: () => invalidate() }));
vi.mock("@/lib/rbac", () => ({
  requireAdminProfile: async () => {
    if (!admin) throw new Error("Forbidden");
    return { workspaceId: "ws-1" };
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.eq = () => q;
      q.maybeSingle = async () => ({ data: order, error: null });
      q.single = async () => ({ data: { id: "new" }, error: null });
      q.then = (ok: (v: unknown) => unknown) => ok({ data: affected, error: null });
      q.insert = (row: Record<string, unknown>) => (writes.push({ table, op: "insert", row }), q);
      q.update = (row: Record<string, unknown>) => (writes.push({ table, op: "update", row }), q);
      q.delete = () => (writes.push({ table, op: "delete" }), q);
      return q;
    },
  }),
}));

import { createReview, deleteReview, setReviewApproved } from "./actions";

const P = "11111111-1111-4111-8111-111111111111";
const R = "22222222-2222-4222-8222-222222222222";
const form = (over: Record<string, string> = {}) => {
  const f = new FormData();
  for (const [k, v] of Object.entries({ product_id: P, name: "Amina B.", rating: "5", body: "Belle", order_seq: "", agreed: "on", ...over })) f.set(k, v);
  return f;
};

describe("review actions", () => {
  beforeEach(() => {
    admin = true;
    order = null;
    affected = [{ id: R }];
    writes = [];
    invalidate.mockClear();
  });

  test("an agent is refused and nothing is written", async () => {
    admin = false;
    await expect(createReview(form())).rejects.toThrow("Forbidden");
    await expect(setReviewApproved(R, true)).rejects.toThrow("Forbidden");
    await expect(deleteReview(R)).rejects.toThrow("Forbidden");
    expect(writes).toEqual([]);
  });

  test("rating 0/6, empty body, missing consent, bad product are invalid", async () => {
    for (const over of [{ rating: "0" }, { rating: "6" }, { rating: "2.5" }, { body: "  " }, { name: " " }, { agreed: "" }, { product_id: "x" }, { body: "x".repeat(1001) }]) {
      expect(await createReview(form(over)), JSON.stringify(over)).toEqual({ ok: false, error: "invalid" });
    }
    expect(writes).toEqual([]);
  });

  test("creates without an order, invalidates the public cache", async () => {
    expect(await createReview(form())).toEqual({ ok: true, id: "new" });
    expect(writes[0]).toMatchObject({ table: "reviews", op: "insert", row: { order_id: null, product_id: P, rating: 5 } });
    expect(invalidate).toHaveBeenCalled();
  });

  test("order #: unknown shows an error, other product / excluded / cancelled refused, a good one links", async () => {
    expect(await createReview(form({ order_seq: "9" }))).toEqual({ ok: false, error: "order_not_found" });
    const base = { id: "o1", product_id: P, confirmation_status: "confirmed", excluded_reason: null };
    for (const o of [{ ...base, product_id: "other" }, { ...base, excluded_reason: "test" }, { ...base, confirmation_status: "cancelled" }]) {
      order = o;
      expect(await createReview(form({ order_seq: "9" }))).toEqual({ ok: false, error: "order_not_verifiable" });
    }
    expect(writes).toEqual([]);
    order = base;
    expect(await createReview(form({ order_seq: "9" }))).toEqual({ ok: true, id: "new" });
    expect(writes[0].row).toMatchObject({ order_id: "o1" });
  });

  test("approve/delete: 0 affected rows is an error and does not invalidate; success invalidates", async () => {
    affected = [];
    expect(await setReviewApproved(R, true)).toEqual({ ok: false, error: "failed" });
    expect(await deleteReview(R)).toEqual({ ok: false, error: "failed" });
    expect(invalidate).not.toHaveBeenCalled();
    affected = [{ id: R }];
    expect(await setReviewApproved(R, true)).toEqual({ ok: true, id: R });
    expect(await deleteReview(R)).toEqual({ ok: true, id: R });
    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(await setReviewApproved("nope", true)).toEqual({ ok: false, error: "invalid" });
  });
});
