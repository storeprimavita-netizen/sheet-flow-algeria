import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));

import type { OrderViewDto } from "@/lib/order-views";
import { resolveView } from "./views-data";

const A = "11111111-1111-4111-8111-111111111111";
const FOREIGN_PRIVATE = "22222222-2222-4222-8222-222222222222";
const OTHER_SCOPE = "33333333-3333-4333-8333-333333333333";
const DELETED = "44444444-4444-4444-8444-444444444444";
// what the session client can see for scope "all": RLS already removed other people's private views,
// the scope filter removed other scopes, and a deleted view is simply gone
const visible: OrderViewDto[] = [
  { id: A, name: "Mine", emoji: null, scope: "all", seed_key: null, shared: false, position: 0, layout: "table", config: { duplicates: "1" } },
];

describe("resolveView", () => {
  test("a visible view resolves", () => {
    expect(resolveView(visible, A)).toEqual({ active: visible[0], invalid: false });
    expect(resolveView(visible, A.toUpperCase()).active?.id).toBe(A);
  });
  test("no param is Default, not invalid", () => {
    expect(resolveView(visible, undefined)).toEqual({ active: null, invalid: false });
    expect(resolveView(visible, "")).toEqual({ active: null, invalid: false });
  });
  test("only Shipping recognizes the legacy Kanban alias", () => {
    expect(resolveView([], "kanban", "shipping")).toEqual({ active: null, invalid: false });
    expect(resolveView([], "kanban", "confirmation")).toEqual({ active: null, invalid: true });
  });
  test.each([
    ["another user's private id", FOREIGN_PRIVATE],
    ["a view from another scope", OTHER_SCOPE],
    ["a deleted view", DELETED],
    ["junk", "x' or 1=1"],
  ])("%s is invalid and indistinguishable", (_n, id) => {
    expect(resolveView(visible, id)).toEqual({ active: null, invalid: true });
  });
  test("array params are invalid", () => {
    expect(resolveView(visible, [A, A]).invalid).toBe(true);
  });
});
