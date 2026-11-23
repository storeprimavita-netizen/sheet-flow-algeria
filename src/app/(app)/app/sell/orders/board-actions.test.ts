import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  profile: vi.fn(), order: vi.fn(), rpc: vi.fn(), push: vi.fn(), revalidate: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/rbac", () => ({ getProfile: mocks.profile }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    const query = { select: () => query, eq: () => query, maybeSingle: mocks.order };
    return { from: () => query, rpc: mocks.rpc };
  },
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: async () => {
    const query = {
      select: () => query, eq: () => query, maybeSingle: async () => ({ data: { value: { enabled: true } } }),
    };
    return { from: () => query };
  },
}));
vi.mock("@/lib/integrations/zrexpress-push", () => ({ pushToZR: mocks.push }));
vi.mock("@/lib/store/invalidate", () => ({ markStorePublicStale: vi.fn() }));

import { moveOrderOnBoard } from "./actions";

const input = {
  orderId: "11111111-1111-4111-8111-111111111111", stage: "confirmation", status: "confirmed",
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.profile.mockResolvedValue({ role: "confirmation_agent", workspaceId: "workspace" });
  mocks.order.mockResolvedValue({ data: { delivery_status: "wait_for_deposit" }, error: null });
  mocks.rpc.mockResolvedValue({ data: false, error: null });
  mocks.push.mockResolvedValue({ ok: true });
});

describe("board status action", () => {
  test("preserves the note and only auto-pushes on the first successful confirmation", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: true, error: null });
    expect(await moveOrderOnBoard(input)).toEqual({ ok: true, warning: false });
    expect(await moveOrderOnBoard(input)).toEqual({ ok: true, warning: false });
    expect(mocks.rpc).toHaveBeenCalledWith("transition_order_status", {
      p_order_id: input.orderId, p_confirmation_status: "confirmed", p_delivery_status: null,
      p_confirmation_comment: null, p_preserve_confirmation_comment: true,
    });
    expect(mocks.push).toHaveBeenCalledTimes(1);
    expect(mocks.revalidate).toHaveBeenCalledWith("/app/sell/confirmation");
  });

  test("refuses invalid moves, other stages and swapped orders before the mutation", async () => {
    expect(await moveOrderOnBoard({ ...input, stage: "delivery", status: "swap" })).toEqual({ ok: false, error: "invalid" });
    expect(await moveOrderOnBoard({ ...input, orderId: "bad" })).toEqual({ ok: false, error: "invalid" });
    expect(await moveOrderOnBoard({ ...input, stage: "delivery", status: "returned" })).toEqual({ ok: false, error: "forbidden" });
    mocks.order.mockResolvedValue({ data: { delivery_status: "swap" }, error: null });
    expect(await moveOrderOnBoard(input)).toEqual({ ok: false, error: "locked" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  test("returns translated error and carrier warning codes without upstream details", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "order already handed to delivery" } });
    expect(await moveOrderOnBoard(input)).toEqual({ ok: false, error: "locked" });
    mocks.rpc.mockResolvedValueOnce({ data: true, error: null });
    mocks.push.mockResolvedValue({ ok: false, error: "Carrier failure" });
    expect(await moveOrderOnBoard(input)).toEqual({ ok: true, warning: true });
  });
});
