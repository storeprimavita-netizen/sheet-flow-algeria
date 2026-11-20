import { describe, expect, test, vi } from "vitest";

const requireAdmin = vi.fn();
const getProfile = vi.fn();
vi.mock("@/lib/rbac", () => ({ requireAdmin: (to: string) => requireAdmin(to), getProfile: () => getProfile() }));

import StatsLayout from "@/app/(app)/app/statistics/layout";

describe("statistics layout guard", () => {
  test("an agent is redirected: requireAdmin rejects and the children never render", async () => {
    getProfile.mockResolvedValueOnce({ role: "delivery_agent", workspaceId: "w" });
    requireAdmin.mockReturnValueOnce(Promise.reject(new Error("redirected-away")));
    let caught = "";
    try {
      await StatsLayout({ children: "secret" });
    } catch (e) {
      caught = (e as Error).message;
    }
    expect(caught).toBe("redirected-away");
    expect(requireAdmin).toHaveBeenCalledWith("/app/my-day");
  });
  test("an admin gets the children", async () => {
    getProfile.mockResolvedValueOnce({ role: "admin", workspaceId: "w" });
    requireAdmin.mockResolvedValueOnce(undefined);
    await expect(StatsLayout({ children: "ok" })).resolves.toBe("ok");
  });
  test("no profile goes to /no-access before requireAdmin", async () => {
    getProfile.mockResolvedValueOnce(null);
    await expect(StatsLayout({ children: "x" })).rejects.toThrow("NEXT_REDIRECT");
  });
});
