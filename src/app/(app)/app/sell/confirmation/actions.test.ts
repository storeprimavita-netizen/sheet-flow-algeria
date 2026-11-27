import { beforeEach, describe, expect, test, vi } from "vitest";

const ORDER = "11111111-1111-4111-8111-111111111111";
let role = "confirmation_agent";
let rpcError: { code: string } | null = null;
let tables: Record<string, { data: unknown; error: unknown }> = {};
const rpc = vi.fn(async () => ({ error: rpcError }));
const revalidated: string[] = [];

function builder(table: string) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "not", "in", "order", "limit"]) q[m] = () => q;
  q.maybeSingle = async () => tables[table];
  q.then = (resolve: (v: unknown) => unknown) => resolve(tables[table]);
  return q;
}

vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidated.push(p) }));
vi.mock("@/lib/rbac", () => ({ getProfile: async () => ({ role, workspaceId: "ws" }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc, from: builder }) }));

const { saveCallback, loadAttempts } = await import("./actions");

beforeEach(() => {
  role = "confirmation_agent";
  rpcError = null;
  rpc.mockClear();
  revalidated.length = 0;
  tables = {};
});

describe("saveCallback", () => {
  const schedule = { op: "schedule", orderId: ORDER, date: "2099-01-02", time: "09:30" };

  test("sends one Algiers instant and revalidates the queue and the order", async () => {
    expect(await saveCallback(schedule)).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("set_order_callback", { p_order_id: ORDER, p_callback_at: "2099-01-02T08:30:00.000Z" });
    expect(revalidated).toEqual(["/app/sell/confirmation", `/app/sell/orders/${ORDER}`]);
  });

  test("clearing is explicit and sends null", async () => {
    expect(await saveCallback({ op: "clear", orderId: ORDER })).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("set_order_callback", { p_order_id: ORDER, p_callback_at: null });
  });

  test("rejects invalid or elapsed input and other roles without calling the database", async () => {
    expect(await saveCallback({ orderId: ORDER })).toEqual({ ok: false, error: "invalid" });
    expect(await saveCallback({ ...schedule, time: null })).toEqual({ ok: false, error: "invalid" });
    expect(await saveCallback({ ...schedule, date: "" })).toEqual({ ok: false, error: "invalid" });
    expect(await saveCallback({ ...schedule, date: "2000-01-01" })).toEqual({ ok: false, error: "past" });
    role = "delivery_agent";
    expect(await saveCallback(schedule)).toEqual({ ok: false, error: "forbidden" });
    expect(rpc).not.toHaveBeenCalled();
  });

  test.each([["42501", "forbidden"], ["55000", "locked"], ["22023", "past"], ["XX000", "failed"]])(
    "maps database error %s to %s and does not revalidate",
    async (code, error) => {
      rpcError = { code };
      expect(await saveCallback(schedule)).toEqual({ ok: false, error });
      expect(revalidated).toEqual([]);
    },
  );
});

describe("loadAttempts", () => {
  const row = (id: number, actor: string | null) => ({
    id, actor, to_status: "no_answer", created_at: `2026-11-${String(id).padStart(2, "0")}T10:00:00Z`,
  });

  test("returns the latest ten oldest first and keeps system and unknown actors apart", async () => {
    // newest first, as the query orders them
    const rows = [row(11, "u1"), row(10, null), row(9, "gone"), ...[8, 7, 6, 5, 4, 3, 2, 1].map((n) => row(n, "u1"))];
    tables = {
      orders: { data: { id: ORDER }, error: null },
      order_status_history: { data: rows, error: null },
      profiles: { data: [{ user_id: "u1", display_name: "Amina" }], error: null },
    };
    const result = await loadAttempts(ORDER);
    if (!result.ok) throw new Error("expected attempts");
    expect(result.more).toBe(true);
    expect(result.attempts.map((a) => a.id)).toEqual(["2", "3", "4", "5", "6", "7", "8", "9", "10", "11"]);
    expect(result.attempts.slice(-3).map((a) => a.actor)).toEqual([{ kind: "unknown" }, { kind: "system" }, { kind: "user", name: "Amina" }]);
  });

  test("an invisible order, a bad id, a read error and a delivery agent all fail closed", async () => {
    tables = { orders: { data: null, error: null } };
    expect(await loadAttempts(ORDER)).toEqual({ ok: false });
    expect(await loadAttempts("nope")).toEqual({ ok: false });
    tables = { orders: { data: { id: ORDER }, error: null }, order_status_history: { data: null, error: { message: "x" } } };
    expect(await loadAttempts(ORDER)).toEqual({ ok: false });
    role = "delivery_agent";
    expect(await loadAttempts(ORDER)).toEqual({ ok: false });
  });
});
