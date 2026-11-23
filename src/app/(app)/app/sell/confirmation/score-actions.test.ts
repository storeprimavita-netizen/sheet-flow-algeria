import { beforeEach, describe, expect, test, vi } from "vitest";

const { getProfile, getUser, rpc } = vi.hoisted(() => ({ getProfile: vi.fn(), getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/rbac", () => ({ getProfile, getUser }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));

import { loadCustomerScore } from "./score-actions";

const orderId = "11111111-1111-4111-8111-111111111111";
const scope = "user:workspace:confirmation_agent";

describe("loadCustomerScore", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getUser.mockResolvedValue({ id: "user" });
    getProfile.mockResolvedValue({ role: "confirmation_agent", workspaceId: "workspace" });
  });

  test("rejects bad input, mismatched scope and disallowed profiles before reading", async () => {
    expect(await loadCustomerScore({ orderId: "bad", scope })).toEqual({ status: "error" });
    expect(await loadCustomerScore({ orderId, scope: "prior-user:workspace:confirmation_agent" })).toEqual({ status: "error" });
    getProfile.mockResolvedValue({ role: "delivery_agent", workspaceId: "workspace" });
    expect(await loadCustomerScore({ orderId, scope: "user:workspace:delivery_agent" })).toEqual({ status: "error" });
    expect(rpc).not.toHaveBeenCalled();
  });

  test("makes one scoped read and masks failures", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null }).mockResolvedValueOnce({ data: null, error: { message: "internal" } });
    expect(await loadCustomerScore({ orderId, scope })).toEqual({ status: "empty" });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("confirmation_customer_score", { p_order_id: orderId });
    expect(await loadCustomerScore({ orderId, scope })).toEqual({ status: "error" });
  });
});
