import { beforeEach, describe, expect, test, vi } from "vitest";

const insert = vi.fn();
let feeRow: Record<string, unknown> | null;

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/lib/store/invalidate", () => ({ markStorePublicStale: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: (t: string) => {
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.eq = () => q;
      q.maybeSingle = async () => ({ data: t === "wilaya_fees" ? feeRow : null });
      q.insert = (row: unknown) => {
        insert(row);
        return { select: () => ({ single: async () => ({ data: { id: "new-order" }, error: null }) }) };
      };
      return q;
    },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/rbac", () => ({
  requireAdminProfile: async () => ({ workspaceId: "ws-1" }),
  getProfile: vi.fn(),
  isCurrentUserAdmin: vi.fn(),
}));
vi.mock("@/lib/customers", () => ({ upsertCustomerFromOrder: async () => "c1" }));
vi.mock("@/lib/integrations/zrexpress", () => ({ getZRCredentials: vi.fn(), getZRParcel: vi.fn(), zrErrorMessage: vi.fn() }));
vi.mock("@/lib/integrations/zrexpress-webhook", () => ({ applyZRParcelState: vi.fn() }));
vi.mock("@/lib/integrations/zrexpress-push", () => ({ hubsForOrder: vi.fn(), pushToZR: vi.fn() }));

import { createOrder } from "./actions";

const form = (type: string) => {
  const f = new FormData();
  const v: Record<string, string> = {
    product_id: "11111111-1111-4111-8111-111111111111",
    variant_id: "",
    quantity: "1",
    customer_name: "A",
    customer_phone: "0555000111",
    wilaya_code: "8",
    commune: "x",
    address: "y",
    delivery_type: type,
    sale_price: "1000",
    delivery_fee: "700",
    delivery_fee_source: "wilaya_table",
  };
  for (const [k, val] of Object.entries(v)) f.set(k, val);
  return f;
};
const row = (over: Record<string, unknown> = {}) => ({
  home_fee: 700, stopdesk_fee: 400, priced: true, stopdesk_available: true, stop_shipping: false, ...over,
});

describe("createOrder availability guard (server side)", () => {
  beforeEach(() => insert.mockClear());

  test("returns a typed error, never inserts, for a stop-desk order in a home-only wilaya", async () => {
    feeRow = row({ stopdesk_available: false });
    expect(await createOrder(form("stopdesk"))).toEqual({ error: "blocked.type_unavailable" });
    expect(insert).not.toHaveBeenCalled();
  });

  test("refuses any order for an unpriced or stop-shipping wilaya", async () => {
    feeRow = row({ priced: false });
    expect(await createOrder(form("home"))).toEqual({ error: "blocked.unpriced" });
    feeRow = row({ stop_shipping: true });
    expect(await createOrder(form("home"))).toEqual({ error: "blocked.stopped" });
    expect(insert).not.toHaveBeenCalled();
  });

  test("no product returns an error instead of throwing", async () => {
    feeRow = row();
    const f = form("home");
    f.set("product_id", "");
    expect(await createOrder(f)).toEqual({ error: "invalid" });
    expect(insert).not.toHaveBeenCalled();
  });

  test("allows home in a home-only wilaya", async () => {
    feeRow = row({ stopdesk_available: false });
    await expect(createOrder(form("home"))).rejects.toThrow("REDIRECT:/app/sell/orders/new-order");
    expect(insert).toHaveBeenCalledTimes(1);
  });
});
