import { describe, expect, test, vi } from "vitest";

const requireAdmin = vi.fn();
const getProfile = vi.fn();
vi.mock("next-intl/server", () => ({ getMessages: async () => ({ statistics: {} }) }));
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
    const el = await StatsLayout({ children: "ok" });
    expect(el.props.children).toBe("ok");
  });
  test("no profile goes to /no-access before requireAdmin", async () => {
    getProfile.mockResolvedValueOnce(null);
    requireAdmin.mockClear();
    const err = await StatsLayout({ children: "x" }).catch((e: { message: string; digest?: string }) => e);
    expect((err as { message: string }).message).toBe("NEXT_REDIRECT");
    expect((err as { digest?: string }).digest).toContain("/no-access");
    expect(requireAdmin).not.toHaveBeenCalled();
  });
});
