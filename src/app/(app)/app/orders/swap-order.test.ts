import { beforeEach, describe, expect, test, vi } from "vitest";

const rpc = vi.fn();
const isFn = vi.fn();
const eqFn = vi.fn();
const updateFn = vi.fn();
const from = vi.fn();
const upsertCustomer = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc, from }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/rbac", () => ({
  requireAdminProfile: async () => ({ workspaceId: "ws-1" }),
  getProfile: vi.fn(),
  isCurrentUserAdmin: vi.fn(),
}));
vi.mock("@/lib/customers", () => ({ upsertCustomerFromOrder: (...a: unknown[]) => upsertCustomer(...a) }));
vi.mock("@/lib/integrations/zrexpress", () => ({ getZRCredentials: vi.fn(), getZRParcel: vi.fn(), zrErrorMessage: vi.fn() }));
vi.mock("@/lib/integrations/zrexpress-webhook", () => ({ applyZRParcelState: vi.fn() }));
vi.mock("@/lib/integrations/zrexpress-push", () => ({ hubsForOrder: vi.fn(), pushToZR: vi.fn() }));

import { swapOrder } from "./actions";

const form = () => {
  const f = new FormData();
  f.set("customer_name", "Swap Client");
  f.set("customer_phone", "0555000111");
  f.set("wilaya_code", "16");
  f.set("commune", "x");
  f.set("address", "y");
  return f;
};
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("swapOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isFn.mockResolvedValue({ error: null });
    eqFn.mockReturnValue({ is: isFn });
    updateFn.mockReturnValue({ eq: eqFn });
    from.mockReturnValue({ update: updateFn });
    rpc.mockResolvedValue({ data: B, error: null });
    upsertCustomer.mockResolvedValue("cust-1");
  });

  test("swapOrder refuses a non-uuid id", async () => {
    await expect(swapOrder("not-a-uuid", form())).rejects.toThrow(/./);
    expect(rpc).not.toHaveBeenCalled();
  });

  test("swapOrder double submit keeps customer", async () => {
    await expect(swapOrder(A, form())).rejects.toThrow(`REDIRECT:/app/orders/${B}`);
    expect(rpc).toHaveBeenCalledWith("swap_order", expect.objectContaining({ p_order_id: A }));
    expect(updateFn).toHaveBeenCalledWith({ customer_id: "cust-1" });
    expect(eqFn).toHaveBeenCalledWith("id", B);
    expect(isFn).toHaveBeenCalledWith("customer_id", null);
  });

  test("swapOrder second submit only ever updates where customer_id is null", async () => {
    await expect(swapOrder(A, form())).rejects.toThrow("REDIRECT");
    await expect(swapOrder(A, form())).rejects.toThrow("REDIRECT");
    for (const c of isFn.mock.calls) expect(c).toEqual(["customer_id", null]);
    expect(updateFn).toHaveBeenCalledTimes(2);
  });

  test("swapOrder returns {error} for a non-numeric wilaya_code", async () => {
    const f = form();
    f.set("wilaya_code", "Chlef");
    await expect(swapOrder(A, f)).resolves.toEqual({ error: "swap.invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });

  test("swapOrder refused for a stopped wilaya gives the stopped reason", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "delivery type home is not available in this wilaya" } });
    const maybeSingle = vi.fn().mockResolvedValue({ data: { stop_shipping: true } });
    const q: Record<string, unknown> = {};
    q.select = () => q;
    q.eq = () => q;
    q.maybeSingle = maybeSingle;
    from.mockReturnValue(q);
    await expect(swapOrder(A, form())).resolves.toEqual({ error: "form.blocked.stopped" });
    maybeSingle.mockResolvedValue({ data: { stop_shipping: false, priced: true } });
    await expect(swapOrder(A, form())).resolves.toEqual({ error: "form.blocked.type_unavailable" });
    maybeSingle.mockResolvedValue({ data: { stop_shipping: false, priced: false } });
    await expect(swapOrder(A, form())).resolves.toEqual({ error: "form.blocked.unpriced" });
    maybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(swapOrder(A, form())).resolves.toEqual({ error: "swap.failed" });
  });
});
