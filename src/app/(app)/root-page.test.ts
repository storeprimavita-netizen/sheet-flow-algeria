import { beforeEach, describe, expect, test, vi } from "vitest";

const getCurrentUserRole = vi.fn();
vi.mock("@/lib/rbac", () => ({ getCurrentUserRole: () => getCurrentUserRole() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));

import Home from "./page";

beforeEach(() => getCurrentUserRole.mockReset());

describe("root page", () => {
  test("redirects per role", async () => {
    const cases: [string | null, string][] = [
      ["admin", "/app/dashboard"],
      ["confirmation_agent", "/app/my-day"],
      ["delivery_agent", "/app/my-day"],
      [null, "/app/dashboard"],
    ];
    for (const [role, to] of cases) {
      getCurrentUserRole.mockResolvedValue(role);
      await expect(Home()).rejects.toThrow(`redirect:${to}`);
    }
  });
});
