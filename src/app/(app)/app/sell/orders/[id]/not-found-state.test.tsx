import { describe, expect, test, vi } from "vitest";
import type { Role } from "@/lib/roles";

let role: Role = "admin";
vi.mock("@/lib/rbac", () => ({
  requireProfile: async () => ({ workspaceId: "w" }),
  getCurrentUserRole: async () => role,
  isCurrentUserAdmin: async () => role === "admin",
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (k: string, v?: Record<string, string>) => (v ? `${k}|${v.page}` : k),
  getLocale: async () => "en",
}));
vi.mock("@/lib/status-labels", () => ({ getStatusLabelOverrides: async () => ({}) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
  }),
}));

import OrderDetailPage from "./page";

async function render(r: Role) {
  role = r;
  const el = await OrderDetailPage({ params: Promise.resolve({ id: "x" }) });
  return JSON.stringify(el);
}

describe("order not-found state", () => {
  test("agent not-found shows the queue title and a back link", async () => {
    for (const [r, key] of [
      ["confirmation_agent", "confirmation"],
      ["delivery_agent", "shipping"],
    ] as const) {
      const out = await render(r);
      expect(out).toContain(`nav.${key}`);
      expect(out).toContain(`navPurpose.${key}`);
      expect(out).not.toContain("navPurpose.all");
      expect(out).toContain(`/app/sell/${key === "shipping" ? "shipping" : "confirmation"}`);
    }
  });
  test("admin not-found links All orders", async () => {
    const out = await render("admin");
    expect(out).toContain("nav.all");
    expect(out).toContain('"href":"/app/sell/orders"');
  });
});
