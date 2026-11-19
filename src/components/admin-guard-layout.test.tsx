import { describe, expect, test, vi } from "vitest";

const requireAdmin = vi.fn();
vi.mock("@/lib/rbac", () => ({ requireAdmin: (to: string) => requireAdmin(to) }));

import StatsLayout from "@/app/(app)/app/statistics/layout";

describe("statistics layout guard", () => {
  test("an agent is redirected: requireAdmin rejects and the children never render", async () => {
    requireAdmin.mockReturnValueOnce(Promise.reject(new Error("redirected-away")));
    let caught = "";
    try {
      await StatsLayout({ children: "secret" });
    } catch (e) {
      caught = (e as Error).message;
    }
    expect(caught).toBe("redirected-away");
    expect(requireAdmin).toHaveBeenCalledWith("/app/orders");
  });
  test("an admin gets the children", async () => {
    requireAdmin.mockResolvedValueOnce(undefined);
    await expect(StatsLayout({ children: "ok" })).resolves.toBe("ok");
  });
});
