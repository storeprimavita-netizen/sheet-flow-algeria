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

describe("sell detail page through the real getProfile -> requireProfile", () => {
  test("real getProfile redirects to /no-access", async () => {
    vi.resetModules();
    vi.doMock("@/lib/rbac", async (orig) => {
      const actual = await orig<typeof import("@/lib/rbac")>();
      return actual;
    });
    vi.doUnmock("@/lib/rbac");
    vi.doMock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(f: T) => f }));
    vi.doMock("@/lib/supabase/server", () => ({
      createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: { id: "u" } } }) },
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
      }),
    }));
    const Page = (await import("./orders/[id]/page")).default;
    await expect(Page({ params })).rejects.toThrow("redirect:/no-access");
  });
});
