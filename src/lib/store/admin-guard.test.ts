import { describe, expect, test, vi } from "vitest";

import { navLeaves } from "@/components/nav-model";

const getProfile = vi.fn();
vi.mock("@/lib/rbac", () => ({ getProfile: () => getProfile() }));
const from = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

describe("store admin guard", () => {
  test("agent sees no Store nav, /app/store 404", async () => {
    for (const role of ["confirmation_agent", "delivery_agent"] as const) {
      expect(navLeaves(role).some((l) => l.href.startsWith("/app/store"))).toBe(false);
    }
    expect(navLeaves("admin").filter((l) => l.href.startsWith("/app/store")).map((l) => l.key)).toEqual(["storeHub", "storePages", "storeReviews", "storeSettings"]);

    const { default: Layout } = await import("@/app/(app)/app/store/layout");
    getProfile.mockResolvedValue({ role: "confirmation_agent", workspaceId: "w" });
    await expect(Layout({ children: null })).rejects.toThrow("NEXT_NOT_FOUND");
    getProfile.mockResolvedValue(null);
    await expect(Layout({ children: null })).rejects.toThrow("NEXT_NOT_FOUND");
    getProfile.mockResolvedValue({ role: "admin", workspaceId: "w" });
    await expect(Layout({ children: "x" })).resolves.toBe("x");
  });

  test("data helpers re-check the role: an agent never reaches the query", async () => {
    const { getStore, requireStoreAdmin } = await import("@/app/(app)/app/store/_lib/data");
    from.mockClear();
    getProfile.mockResolvedValue({ role: "confirmation_agent", workspaceId: "w" });
    await expect(getStore()).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(requireStoreAdmin()).rejects.toThrow("NEXT_NOT_FOUND");
    getProfile.mockResolvedValue(null);
    await expect(requireStoreAdmin()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(from).not.toHaveBeenCalled();
  });

  test("getStore throws on DB error, never returns null", async () => {
    const { getStore } = await import("@/app/(app)/app/store/_lib/data");
    getProfile.mockResolvedValue({ role: "admin", workspaceId: "w" });
    const q: Record<string, unknown> = {};
    for (const m of ["select", "order", "limit"]) q[m] = () => q;
    q.maybeSingle = () => Promise.resolve({ data: null, error: { message: "boom" } });
    from.mockReturnValue(q);
    await expect(getStore()).rejects.toThrow(/boom/);
  });

  test("editor and preview pages call requireStoreAdmin/getStore for an agent", async () => {
    getProfile.mockResolvedValue({ role: "confirmation_agent", workspaceId: "w" });
    from.mockClear();
    const { default: Editor } = await import("@/app/(app)/app/store/pages/[id]/page");
    const { default: Preview } = await import("@/app/(app)/app/store/pages/[id]/preview/page");
    const props = { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000000" }), searchParams: Promise.resolve({}) };
    await expect(Editor(props as never)).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(Preview(props as never)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(from).not.toHaveBeenCalled();
  });
});
