import { beforeEach, describe, expect, test, vi } from "vitest";

const rpc = vi.fn();
const from = vi.fn();
const update = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc, from }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/rbac", () => ({
  requireAdminProfile: async () => ({ workspaceId: "ws-1" }),
  getProfile: vi.fn(),
  isCurrentUserAdmin: vi.fn(),
}));
vi.mock("@/lib/customers", () => ({ upsertCustomerFromOrder: vi.fn() }));
vi.mock("@/lib/integrations/zrexpress", () => ({ getZRCredentials: vi.fn(), getZRParcel: vi.fn(), zrErrorMessage: vi.fn() }));
vi.mock("@/lib/integrations/zrexpress-webhook", () => ({ applyZRParcelState: vi.fn() }));
vi.mock("@/lib/integrations/zrexpress-push", () => ({ hubsForOrder: vi.fn(), pushToZR: vi.fn() }));

import { switchOrderToHome } from "./actions";

const A = "11111111-1111-4111-8111-111111111111";

function table(data: unknown) {
  const q: Record<string, unknown> = {};
  q.select = () => q;
  q.eq = () => q;
  q.maybeSingle = async () => ({ data });
  q.update = (...a: unknown[]) => {
    update(...a);
    return { eq: () => ({ eq: async () => ({ error: null }) }) };
  };
  return q;
}

function setup(o: { order?: object | null; sent?: object | null; stopped?: boolean; fee?: number | null }) {
  const order = o.order === undefined ? { wilaya_code: 5, delivery_type: "stopdesk", delivery_status: "wait_for_deposit" } : o.order;
  from.mockImplementation((t: string) =>
    t === "orders" ? table(order) : t === "zr_shipments" ? table(o.sent ?? null) : table({ stop_shipping: !!o.stopped }),
  );
  rpc.mockResolvedValue({ data: o.fee === undefined ? 700 : o.fee });
}

describe("switchOrderToHome", () => {
  beforeEach(() => vi.clearAllMocks());

  test("refuses an order past the waiting stage", async () => {
    setup({ order: { wilaya_code: 5, delivery_type: "stopdesk", delivery_status: "in_transit" } });
    await expect(switchOrderToHome(A)).resolves.toEqual({ ok: false, error: "orders.zrexpress.switch.status" });
  });
  test("refuses an order already sent to ZR", async () => {
    setup({ sent: { order_id: A } });
    await expect(switchOrderToHome(A)).resolves.toEqual({ ok: false, error: "orders.zrexpress.switch.sent" });
  });
  test("refuses an order already home", async () => {
    setup({ order: { wilaya_code: 5, delivery_type: "home", delivery_status: "wait_for_deposit" } });
    await expect(switchOrderToHome(A)).resolves.toEqual({ ok: false, error: "orders.zrexpress.switch.alreadyHome" });
  });
  test("refuses a stopped wilaya", async () => {
    setup({ stopped: true });
    await expect(switchOrderToHome(A)).resolves.toEqual({ ok: false, error: "orders.zrexpress.switch.stopped" });
    expect(update).not.toHaveBeenCalled();
  });
  test("switches and re-seeds the fee otherwise", async () => {
    setup({});
    await expect(switchOrderToHome(A)).resolves.toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith({ delivery_type: "home", delivery_fee: 700, delivery_fee_source: "wilaya_table" });
  });
});
