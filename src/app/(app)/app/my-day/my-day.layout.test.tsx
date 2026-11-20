import { beforeEach, describe, expect, test, vi } from "vitest";

const getCurrentUserRole = vi.fn();
const redirect = vi.fn((to: string) => {
  throw new Error(`redirect:${to}`);
});
vi.mock("@/lib/rbac", () => ({ getCurrentUserRole: () => getCurrentUserRole() }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) }));

import MyDayLayout from "./layout";

beforeEach(() => {
  getCurrentUserRole.mockReset();
  redirect.mockClear();
});

describe("my-day layout guard", () => {
  test("admin -> /app/dashboard", async () => {
    getCurrentUserRole.mockResolvedValue("admin");
    await expect(MyDayLayout({ children: "x" })).rejects.toThrow("redirect:/app/dashboard");
  });
  test("agent renders children", async () => {
    for (const role of ["confirmation_agent", "delivery_agent"]) {
      getCurrentUserRole.mockResolvedValue(role);
      await expect(MyDayLayout({ children: "ok" })).resolves.toBe("ok");
    }
    expect(redirect).not.toHaveBeenCalled();
  });
  test("no role does not redirect to itself", async () => {
    getCurrentUserRole.mockResolvedValue(null);
    await expect(MyDayLayout({ children: "x" })).rejects.toThrow("redirect:/app/dashboard");
    expect(redirect).not.toHaveBeenCalledWith("/app/my-day");
  });
});
