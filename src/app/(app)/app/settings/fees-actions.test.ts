import { beforeEach, describe, expect, test, vi } from "vitest";

type Row = {
  wilaya_code: number; home_fee: number; stopdesk_fee: number; stop_shipping: boolean;
  priced: boolean; stopdesk_available: boolean; updated_at: string;
};
let stored: Row[];
let upserts: Record<string, unknown>[][];
const getZRRates = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (t: string) => {
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.eq = () => q;
      q.then = (ok: (v: unknown) => unknown) => ok({ data: t === "wilayas" ? [{ code: 1 }, { code: 33 }] : stored, error: null });
      q.upsert = async (rows: Record<string, unknown>[]) => (upserts.push(rows), { error: null });
      return q;
    },
  }),
}));
vi.mock("@/lib/rbac", () => ({ requireAdminProfile: async () => ({ workspaceId: "ws-1" }) }));
vi.mock("@/lib/settings", () => ({ setSetting: vi.fn(), SETTINGS_SCHEMAS: {}, MEETING_SLOT_COUNT: 3, zrStateKey: vi.fn() }));
vi.mock("@/lib/webhook", () => ({ replayEvent: vi.fn(), lightfunnelProvider: {}, shopifyProvider: {} }));
vi.mock("@/lib/integrations/zrexpress", () => ({
  searchZRTerritories: vi.fn(),
  createZRWebhookEndpoint: vi.fn(),
  getZRCredentials: async () => ({}),
  getZRRates: (...a: unknown[]) => getZRRates(...a),
  zrErrorMessage: vi.fn(),
}));

import { saveWilayaFees, syncZRFees } from "./actions";

const T0 = "2026-01-01T00:00:00.000Z";
const row = (over: Partial<Row> = {}): Row => ({
  wilaya_code: 1, home_fee: 1400, stopdesk_fee: 970, stop_shipping: false, priced: true, stopdesk_available: true, updated_at: T0, ...over,
});
const form = (fields: Record<string, string>, snapshot = T0) => {
  const f = new FormData();
  f.set("snapshot", snapshot);
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

describe("saveWilayaFees", () => {
  beforeEach(() => {
    upserts = [];
    stored = [row(), row({ wilaya_code: 33, home_fee: 0, stopdesk_fee: 0, priced: false, stopdesk_available: false })];
  });

  test('"no price" round trip: an unpriced wilaya stays unpriced and its stored fee is never overwritten with 0', async () => {
    // wilaya 1 unchanged, wilaya 33 posts nothing (unpriced switch off, inputs not rendered)
    const res = await saveWilayaFees(form({ priced_1: "on", desk_1: "on", home_1: "1400", stopdesk_1: "970" }));
    expect(res).toBeUndefined();
    expect(upserts).toHaveLength(0);
  });

  test("turning a wilaya off writes priced=false and keeps the stored fees", async () => {
    await saveWilayaFees(form({ desk_1: "on" }));
    expect(upserts[0]).toEqual([expect.objectContaining({ wilaya_code: 1, priced: false, home_fee: 1400, stopdesk_fee: 970, stopdesk_available: true })]);
  });

  test("a stale snapshot is refused with an error key and writes nothing", async () => {
    const res = await saveWilayaFees(form({ priced_1: "on", desk_1: "on" }, "2025-12-31T00:00:00.000Z"));
    expect(res).toEqual({ error: "errStale" });
    expect(upserts).toHaveLength(0);
  });

  test("re-enabling a wilaya at 0 DZD is refused; with a fee it is saved", async () => {
    const bad = await saveWilayaFees(form({ priced_1: "on", desk_1: "on", priced_33: "on", home_33: "" }));
    expect(bad).toEqual({ error: "errNeedFee", codes: [33] });
    expect(upserts).toHaveLength(0);
    const ok = await saveWilayaFees(form({ priced_1: "on", desk_1: "on", priced_33: "on", home_33: "500" }));
    expect(ok).toBeUndefined();
    expect(upserts[0]).toEqual([expect.objectContaining({ wilaya_code: 33, priced: true, home_fee: 500 })]);
  });

  test("an invalid amount returns an error key", async () => {
    expect(await saveWilayaFees(form({ priced_1: "on", desk_1: "on", home_1: "-5" }))).toEqual({ error: "errInvalid" });
  });
});

describe("syncZRFees", () => {
  test("upserts only fee columns, so priced / stopdesk_available / stop_shipping survive", async () => {
    upserts = [];
    stored = [row({ priced: false, stopdesk_available: false, stop_shipping: true })];
    getZRRates.mockResolvedValue([{ territoryCode: 1, level: "wilaya", home: 1500, stopdesk: null }]);
    expect(await syncZRFees()).toEqual({ ok: true, updated: 1 });
    expect(Object.keys(upserts[0][0]).sort()).toEqual(["home_fee", "stopdesk_fee", "wilaya_code", "workspace_id"]);
  });
});
