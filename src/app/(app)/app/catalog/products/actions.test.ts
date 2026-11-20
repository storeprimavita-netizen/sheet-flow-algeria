import { beforeEach, describe, expect, test, vi } from "vitest";

const rpc = vi.fn();
const createClient = vi.fn(async () => ({ rpc }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => createClient() }));
vi.mock("@/lib/rbac", () => ({ requireAdminProfile: async () => ({ workspaceId: "ws-1", role: "admin" }) }));
vi.mock("@/lib/store/invalidate", () => ({ invalidateStorePublic: vi.fn() }));

import { saveVariantConfig } from "./actions";

const PID = "11111111-1111-4111-8111-111111111111";
const id = () => crypto.randomUUID();

beforeEach(() => vi.clearAllMocks());

describe("saveVariantConfig refusal (00070)", () => {
  test("a size with no values is refused before any RPC, with or without options", async () => {
    const bare = { id: id(), sku: null, is_active: true, values: {} };
    const o = { id: id(), name: "Size", values: [{ id: id(), label: "S" }] };
    for (const cfg of [{ options: [o], variants: [bare] }, { options: [], variants: [bare] }]) {
      expect(await saveVariantConfig(PID, cfg)).toEqual({ ok: false, code: "invalid" });
    }
    expect(rpc).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });
});
