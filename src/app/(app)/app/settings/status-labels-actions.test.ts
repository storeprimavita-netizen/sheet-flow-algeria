import { beforeEach, describe, expect, test, vi } from "vitest";

type Call = { op: string; table: string; payload?: unknown; filters: [string, string, unknown][] };
let calls: Call[];
let isAdmin = true;

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      const start = (op: string, payload?: unknown) => {
        const call: Call = { op, table, payload, filters: [] };
        calls.push(call);
        const q: Record<string, unknown> = {};
        q.eq = (c: string, v: unknown) => (call.filters.push(["eq", c, v]), q);
        q.is = (c: string, v: unknown) => (call.filters.push(["is", c, v]), q);
        q.then = (ok: (v: unknown) => unknown) => ok({ error: null });
        return q;
      };
      return {
        delete: () => start("delete"),
        update: (p: unknown) => start("update", p),
        upsert: (p: unknown) => start("upsert", p),
      };
    },
  }),
}));
vi.mock("@/lib/rbac", () => ({
  requireAdminProfile: async () => {
    if (!isAdmin) throw new Error("Forbidden");
    return { workspaceId: "ws-1" };
  },
}));
vi.mock("@/lib/settings", () => ({ setSetting: vi.fn(), SETTINGS_SCHEMAS: {}, MEETING_SLOT_COUNT: 3, zrStateKey: vi.fn() }));
vi.mock("@/lib/webhook", () => ({ replayEvent: vi.fn(), lightfunnelProvider: {}, shopifyProvider: {} }));
vi.mock("@/lib/integrations/zrexpress", () => ({
  searchZRTerritories: vi.fn(),
  createZRWebhookEndpoint: vi.fn(),
  getZRCredentials: async () => ({}),
  getZRRates: vi.fn(),
  zrErrorMessage: vi.fn(),
}));

import { resetStatusLabel, saveStatusLabel } from "./actions";
import { setOptionEmoji } from "@/lib/option-sets-actions";

const target = { kind: "confirmation", key: "confirmed" };
const ID = "00000000-0000-4000-8000-000000000001";

describe("status label actions", () => {
  beforeEach(() => {
    calls = [];
    isAdmin = true;
  });

  test("agent is rejected before any DB call", async () => {
    isAdmin = false;
    await expect(saveStatusLabel({ ...target, lang: "en", value: "x" })).rejects.toThrow("Forbidden");
    await expect(resetStatusLabel(target)).rejects.toThrow("Forbidden");
    await expect(setOptionEmoji(ID, "🔥")).rejects.toThrow("Forbidden");
    expect(calls).toEqual([]);
  });

  test("per-language save sends only that column", async () => {
    expect(await saveStatusLabel({ ...target, lang: "ar", value: " نعم " })).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0].op).toBe("upsert");
    expect(calls[0].payload).toEqual({ workspace_id: "ws-1", kind: "confirmation", status_key: "confirmed", label_ar: "نعم" });
  });

  test("clearing a language deletes the row only when the other is empty, then nulls the column", async () => {
    expect(await saveStatusLabel({ ...target, lang: "en", value: "  " })).toEqual({ ok: true });
    expect(calls.map((c) => c.op)).toEqual(["delete", "update"]);
    expect(calls[0].filters).toContainEqual(["is", "label_ar", null]);
    expect(calls[1].payload).toEqual({ label_en: null });
  });

  test("invalid input never reaches the DB", async () => {
    expect(await saveStatusLabel({ ...target, lang: "fr", value: "x" })).toEqual({ ok: false, error: "invalid" });
    expect(await saveStatusLabel({ ...target, lang: "en", value: "ㅤ" })).toEqual({ ok: false, error: "invalid" });
    expect(await saveStatusLabel({ kind: "nope", key: "x", lang: "en", value: "x" })).toEqual({ ok: false, error: "invalid" });
    expect(calls).toEqual([]);
  });

  test("reset deletes the row", async () => {
    expect(await resetStatusLabel(target)).toEqual({ ok: true });
    expect(calls.map((c) => c.op)).toEqual(["delete"]);
  });
});
