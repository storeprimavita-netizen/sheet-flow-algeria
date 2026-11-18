import { beforeEach, describe, expect, test, vi } from "vitest";

const upsert = vi.fn();
const maybeSingle = vi.fn();
const del = vi.fn();
const setSetting = vi.fn();
const requireAdmin = vi.fn();

const chain = () => {
  const c: Record<string, unknown> = {};
  c.select = () => c;
  c.eq = () => c;
  c.maybeSingle = maybeSingle;
  c.upsert = upsert;
  c.delete = () => ({ eq: () => ({ eq: del }) });
  return c;
};

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: () => chain() }) }));
vi.mock("@/lib/rbac", () => ({ requireAdminProfile: () => requireAdmin() }));
vi.mock("@/lib/settings", async (orig) => ({
  ...(await orig<typeof import("@/lib/settings")>()),
  setSetting: (...a: unknown[]) => setSetting(...a),
}));
vi.mock("@/lib/webhook", () => ({ replayEvent: vi.fn(), lightfunnelProvider: {}, shopifyProvider: {} }));
vi.mock("@/lib/integrations/zrexpress", () => ({
  searchZRTerritories: vi.fn(),
  createZRWebhookEndpoint: vi.fn(),
  getZRCredentials: vi.fn(),
  getZRRates: vi.fn(),
  zrErrorMessage: vi.fn(),
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

import { DEFAULT_PRICING_SETTINGS as DEFAULTS_P } from "@/lib/pricing-v2";
import { resetPricingDefaults, savePricingDefaults } from "@/app/app/settings/actions";
import { saveProductPricing } from "./actions";

const PID = "11111111-1111-4111-8111-111111111111";
const ok = { productId: PID, overrides: {}, adBestUsd: null, adMediumUsd: 2.2, adWorstUsd: null, finalPrice: null };

beforeEach(() => {
  vi.clearAllMocks();
  requireAdmin.mockResolvedValue({ workspaceId: "ws-1", role: "admin" });
  maybeSingle.mockResolvedValue({ data: { id: PID } });
  upsert.mockResolvedValue({ error: null });
  del.mockResolvedValue({ error: null });
  setSetting.mockResolvedValue({ ok: true });
});

describe("saveProductPricing", () => {
  test("saves a valid input", async () => {
    expect(await saveProductPricing(ok)).toEqual({ ok: true });
    expect(upsert).toHaveBeenCalledOnce();
  });
  test("rejects a non-UUID product id", async () => {
    expect(await saveProductPricing({ ...ok, productId: "nope" })).toEqual({ ok: false, error: "invalid" });
    expect(upsert).not.toHaveBeenCalled();
  });
  test("a product of another workspace is notFound", async () => {
    maybeSingle.mockResolvedValue({ data: null });
    expect(await saveProductPricing(ok)).toEqual({ ok: false, error: "notFound" });
    expect(upsert).not.toHaveBeenCalled();
  });
  test("agent session is rejected", async () => {
    requireAdmin.mockRejectedValue(new Error("Forbidden"));
    await expect(saveProductPricing(ok)).rejects.toThrow("Forbidden");
    expect(upsert).not.toHaveBeenCalled();
  });
  test("sub-cent values are refused, not silently rounded", async () => {
    expect((await saveProductPricing({ ...ok, adMediumUsd: 2.255 })).ok).toBe(false);
    expect((await saveProductPricing({ ...ok, finalPrice: 0.004 })).ok).toBe(false);
  });
});

describe("pricing defaults actions", () => {
  test("save: invalid payload refused", async () => {
    expect(await savePricingDefaults({ share: 5 })).toEqual({ ok: false, error: "invalid" });
    expect(setSetting).not.toHaveBeenCalled();
  });
  test("save: agent rejected; reset: agent rejected", async () => {
    requireAdmin.mockRejectedValue(new Error("Forbidden"));
    await expect(savePricingDefaults(DEFAULTS_P)).rejects.toThrow("Forbidden");
    await expect(resetPricingDefaults()).rejects.toThrow("Forbidden");
    expect(setSetting).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });
  test("save valid + reset as admin", async () => {
    expect(await savePricingDefaults(DEFAULTS_P)).toEqual({ ok: true });
    expect(await resetPricingDefaults()).toEqual({ ok: true });
  });
});
