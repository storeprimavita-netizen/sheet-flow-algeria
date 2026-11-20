import { describe, expect, test, vi } from "vitest";

vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(f: T) => f }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
  notFound: () => {
    throw new Error("notFound");
  },
}));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (k: string) => k }));
vi.mock("@/components/locale-switcher", () => ({ LocaleSwitcher: () => null }));
vi.mock("@/components/sign-out-button", () => ({ SignOutButton: () => null }));
const from = vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }));
// signed in, but no profile row
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from,
    auth: { getUser: async () => ({ data: { user: { id: "u", email: "a@b.dz" } } }) },
  }),
}));
vi.mock("@/lib/rbac", async (orig) => {
  const actual = await orig<typeof import("@/lib/rbac")>();
  return { ...actual, getProfile: async () => null, getCurrentUserRole: async () => null };
});

import Home from "../page";
import { AdminGuardLayout } from "@/components/admin-guard-layout";
import AppLayout from "../app/layout";
import OrdersIndexPage from "../app/orders/page";
import MyDayLayout from "../app/my-day/layout";
import { requireAdmin } from "@/lib/rbac";
import AppNotFound from "../app/not-found";
import NoAccessPage from "./page";
import UnmatchedAppRoute from "../app/[...rest]/page";
import { isValidElement } from "react";

type Step = () => Promise<unknown>;
const pages: Record<string, Step> = {
  "/": () => Home(),
  "/app/dashboard": () => AppLayout({ children: null }),
  // proxy.ts (updateSession): a signed-in user on /login is sent to /app/dashboard
  "/login": async () => {
    throw new Error("redirect:/app/dashboard");
  },
  // unmatched /app/** URL: the layout guard runs before the catch-all page
  "/app/[...rest]": () => AppLayout({ children: null }),
  "/app/orders": () => OrdersIndexPage(),
  "/app/my-day": () => MyDayLayout({ children: null }),
  "/app/sell/orders": () => AdminGuardLayout({ children: null }),
  "/app/sell/orders/new": () => requireAdmin("/app/orders"),
  "/app/catalog/pricing": () => requireAdmin("/app/orders"),
  "/app/catalog/products/x/pricing": () => requireAdmin("/app/orders"),
};

/** Follows redirects from a path; returns the number of hops to /no-access. */
async function hops(start: string): Promise<number> {
  let path = start;
  for (let n = 0; n <= 5; n++) {
    if (path === "/no-access") return n;
    const step = pages[path];
    if (!step) throw new Error(`no handler for ${path}`);
    try {
      await step();
    } catch (e) {
      const m = /^redirect:(.+)$/.exec((e as Error).message);
      if (!m) throw e;
      path = m[1];
      continue;
    }
    throw new Error(`${path} rendered for a null profile`);
  }
  throw new Error(`cycle from ${start}`);
}

describe("null profile never cycles", () => {
  for (const start of Object.keys(pages)) {
    test(`${start} reaches /no-access in <= 2 hops`, async () => {
      expect(await hops(start)).toBeLessThanOrEqual(2);
    });
  }
  test("/app/dashboard section guard resolves in one hop", async () => {
    expect(await hops("/app/dashboard")).toBe(1);
  });
  test("[...rest]: guard redirects, and the page itself only calls notFound", async () => {
    expect(await hops("/app/[...rest]")).toBe(1);
    await expect(Promise.resolve().then(() => UnmatchedAppRoute())).rejects.toThrow("notFound");
  });
  test("/login signed-in null profile <= 2 hops", async () => {
    expect(await hops("/login")).toBe(2);
  });
  test("not-found link ends at /no-access", async () => {
    const tree = await AppNotFound();
    const walk = (n: unknown): string | null => {
      if (!isValidElement(n)) return null;
      const p = n.props as { href?: string; children?: unknown };
      if (typeof p.href === "string") return p.href;
      for (const c of [p.children].flat()) { const h = walk(c); if (h) return h; }
      return null;
    };
    expect(walk(tree)).toBe("/no-access");
  });
  test("/no-access never redirects for a null profile", async () => {
    await expect(NoAccessPage()).resolves.toBeTruthy();
  });
});
