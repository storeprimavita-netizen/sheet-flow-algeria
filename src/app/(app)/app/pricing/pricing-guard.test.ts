import { beforeEach, describe, expect, test, vi } from "vitest";

// Real rbac.ts on a mocked session client: only the role changes between cases.
let role: string | null = "confirmation_agent";
const from = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: role ? { id: "u1" } : null } }) },
    from: (table: string) => {
      from(table);
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: role ? { role, workspace_id: "w", is_active: true } : null }) }),
        }),
      };
    },
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (k: string) => k }));

beforeEach(() => {
  from.mockClear();
  vi.resetModules();
});

describe("pricing is admin-only", () => {
  test("agent is redirected from pricing", async () => {
    for (const r of ["confirmation_agent", "delivery_agent"]) {
      role = r;
      const { default: Page } = await import("@/app/(app)/app/pricing/page");
      await expect(Page()).rejects.toThrow("REDIRECT:/app/orders");
    }
    expect(from).not.toHaveBeenCalledWith("product_costs");
    expect(from).not.toHaveBeenCalledWith("products");
  });

  test("signed-out user is redirected from pricing", async () => {
    role = null;
    const { default: Page } = await import("@/app/(app)/app/pricing/page");
    await expect(Page()).rejects.toThrow("REDIRECT:/app/orders");
  });

  test("agent is redirected from the planner bookmark, which lands on the guarded pricing page", async () => {
    const { default: Planner } = await import("@/app/(app)/app/products/planner/page");
    expect(() => Planner()).toThrow("REDIRECT:/app/pricing");
    role = "confirmation_agent";
    const { default: Page } = await import("@/app/(app)/app/pricing/page");
    await expect(Page()).rejects.toThrow("REDIRECT:/app/orders");
  });
});
