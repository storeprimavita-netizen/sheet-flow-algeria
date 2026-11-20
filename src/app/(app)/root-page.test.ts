import { beforeEach, describe, expect, test, vi } from "vitest";

const getCurrentUserRole = vi.fn();
const getUser = vi.fn();
vi.mock("@/lib/rbac", () => ({ getCurrentUserRole: () => getCurrentUserRole(), getUser: () => getUser() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));

import Home from "./page";

beforeEach(() => {
  getCurrentUserRole.mockReset();
  getUser.mockReset();
  getUser.mockResolvedValue({ id: "u" });
});

describe("root page", () => {
  test("redirects per role", async () => {
    const cases: [string | null, string][] = [
      ["admin", "/app/dashboard"],
      ["confirmation_agent", "/app/my-day"],
      ["delivery_agent", "/app/my-day"],
      [null, "/no-access"],
    ];
    for (const [role, to] of cases) {
      getCurrentUserRole.mockResolvedValue(role);
      await expect(Home()).rejects.toThrow(`redirect:${to}`);
    }
  });
  test("signed out -> /login", async () => {
    getUser.mockResolvedValue(null);
    await expect(Home()).rejects.toThrow("redirect:/login");
  });
});
