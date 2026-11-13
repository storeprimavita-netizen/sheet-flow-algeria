import { beforeEach, describe, expect, test, vi } from "vitest";

const updates: Record<string, unknown>[] = [];
const parcels: Record<string, string[]> = { w1: ["bad", "p2"], w2: ["p3"] };

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: async () => ({
    from: (t: string) => {
      let ws = "";
      const q: Record<string, unknown> = {};
      const chain = () => q;
      Object.assign(q, {
        select: chain, or: chain, order: chain, limit: chain,
        eq: (k: string, v: string) => { if (k === "workspace_id") ws = v; return q; },
        update: (v: Record<string, unknown>) => { updates.push(v); return q; },
        then: (res: (v: unknown) => void) =>
          res({ data: t === "integration_configs" ? [{ workspace_id: "w1" }, { workspace_id: "w2" }] : (parcels[ws] ?? []).map((parcel_id) => ({ parcel_id })) }),
      });
      return q;
    },
  }),
}));
vi.mock("@/lib/integrations/zrexpress", () => ({
  getZRCredentials: async (_a: unknown, ws: string) => { if (ws === "boom") throw new Error("x"); return {}; },
  getZRParcel: async (_c: unknown, id: string) => { if (id === "bad") throw new Error("zr down"); return { state: { name: "Livre" }, trackingNumber: "T" }; },
}));
vi.mock("@/lib/integrations/zrexpress-webhook", () => ({ applyZRParcelState: async () => {} }));

import { GET } from "./route";

describe("cron zr-sync", () => {
  beforeEach(() => { updates.length = 0; process.env.CRON_SECRET = "s"; });
  test("one failing parcel does not stop the rest and is still rotated (last_synced_at set)", async () => {
    const r = await GET(new Request("http://x", { headers: { authorization: "Bearer s" } }));
    expect(await r.json()).toMatchObject({ polled: 2, failed: 1 });
    // 2 successes + 1 rotation bump for the failed parcel
    expect(updates.filter((u) => "last_synced_at" in u).length).toBe(3);
  });
});
