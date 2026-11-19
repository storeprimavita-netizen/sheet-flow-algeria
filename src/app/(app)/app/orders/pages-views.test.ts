import { beforeEach, describe, expect, test, vi } from "vitest";

const calls: string[] = [];
let views: unknown[] = [];

function builder(table: string): Record<string, unknown> {
  const q: Record<string, unknown> = {};
  const log = table === "orders" ? calls : [];
  for (const m of ["select", "eq", "in", "or", "gte", "lte", "neq", "order", "range", "is"]) {
    q[m] = (...a: unknown[]) => (log.push(`${m}:${a.map((x) => (Array.isArray(x) ? x.join("|") : String(x))).join("=")}`), q);
  }
  q.then = (res: (v: unknown) => unknown) => res({ data: [], count: 0, error: null });
  return q;
}

vi.mock("next-intl/server", () => ({ getTranslations: async () => (k: string) => k }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: (t: string) => builder(t) }) }));
vi.mock("@/lib/rbac", () => ({ isCurrentUserAdmin: async () => false, getProfile: async () => ({ workspaceId: "ws" }) }));
vi.mock("@/lib/option-sets", () => ({ getOptionSet: async () => [] }));
vi.mock("../_lib/swap-links", () => ({ swapTargets: async () => new Map() }));
vi.mock("./_lib/swap-links", () => ({ swapTargets: async () => new Map() }));
vi.mock("./_lib/views-data", async (orig) => ({
  ...(await orig<typeof import("./_lib/views-data")>()),
  listViews: async () => ({ views }),
}));

function hasType(node: unknown, name: string): boolean {
  if (Array.isArray(node)) return node.some((n) => hasType(n, name));
  if (!node || typeof node !== "object") return false;
  const el = node as { type?: { name?: string }; props?: { children?: unknown } };
  return el.type?.name === name || hasType(el.props?.children, name);
}

const ADMIN_VIEW = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  calls.length = 0;
  views = [];
});

describe("order pages and views", () => {
  test("delivery filters confirmed whatever the view says", async () => {
    views = [
      { id: ADMIN_VIEW, name: "V", emoji: null, scope: "shipping", seed_key: null, shared: true, position: 0, config: { confirmation_status: ["no_answer"] } },
    ];
    const { default: Page } = await import("./delivery/page");
    await Page({ searchParams: Promise.resolve({ view: ADMIN_VIEW, confirmation_status: "cancelled" }) });
    const conf = calls.map((c, i) => [c, i] as const).filter(([c]) => c.startsWith("eq:confirmation_status="));
    expect(conf.at(-1)?.[0]).toBe("eq:confirmation_status=confirmed");
    // the page filter comes after the view filter, so a view can only narrow
    const viewIn = calls.findIndex((c) => c.startsWith("in:confirmation_status="));
    expect(conf.at(-1)![1]).toBeGreaterThan(viewIn);
  });

  test("agent opening an admin's ?view on all gets no view filter", async () => {
    views = []; // RLS: the agent's list does not contain the admin's private view
    const { default: Page } = await import("./all/page");
    const el = await Page({ searchParams: Promise.resolve({ view: ADMIN_VIEW }) });
    expect(calls.some((c) => /^(in|eq|or|gte|lte):/.test(c))).toBe(false);
    expect(hasType(el, "InvalidViewNotice")).toBe(true);
  });
});
