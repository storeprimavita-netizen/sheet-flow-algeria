import { describe, expect, test, vi } from "vitest";

const redirect = vi.fn((to: string) => {
  throw new Error(`redirect:${to}`);
});
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to), notFound: () => { throw new Error("notFound"); } }));
vi.mock("@/lib/rbac", () => ({
  requireProfile: () => redirect("/no-access"),
  getCurrentUserRole: async () => null,
  isCurrentUserAdmin: async () => false,
}));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (k: string) => k, getLocale: async () => "en" }));
vi.mock("@/lib/status-labels", () => ({ getStatusLabelOverrides: async () => ({}) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => { throw new Error("queried"); } }));

import CustomerDetailPage from "./customers/[id]/page";
import OrderDetailPage from "./orders/[id]/page";

const params = Promise.resolve({ id: "x" });

describe("sell detail pages with a null profile", () => {
  test("sell-customers-id -> /no-access", async () => {
    await expect(CustomerDetailPage({ params })).rejects.toThrow("redirect:/no-access");
  });
  test("sell-orders-id -> /no-access", async () => {
    await expect(OrderDetailPage({ params })).rejects.toThrow("redirect:/no-access");
  });
});
