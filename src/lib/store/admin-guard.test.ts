import { describe, expect, test, vi } from "vitest";

import { navLeaves } from "@/components/nav-model";

const getProfile = vi.fn();
vi.mock("@/lib/rbac", () => ({ getProfile: () => getProfile() }));
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
    expect(navLeaves("admin").filter((l) => l.href.startsWith("/app/store")).map((l) => l.key)).toEqual(["storeHub", "storePages", "storeSettings"]);

    const { default: Layout } = await import("@/app/(app)/app/store/layout");
    getProfile.mockResolvedValue({ role: "confirmation_agent", workspaceId: "w" });
    await expect(Layout({ children: null })).rejects.toThrow("NEXT_NOT_FOUND");
    getProfile.mockResolvedValue(null);
    await expect(Layout({ children: null })).rejects.toThrow("NEXT_NOT_FOUND");
    getProfile.mockResolvedValue({ role: "admin", workspaceId: "w" });
    await expect(Layout({ children: "x" })).resolves.toBe("x");
  });
});
