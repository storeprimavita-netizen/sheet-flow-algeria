import { describe, it, expect } from "vitest";

import { GROUPS, HOME, activeLeafHref, navLeaves, parseClosedGroups, visibleNav } from "@/components/nav-model";
import en from "@/messages/en.json";
import ar from "@/messages/ar.json";

describe("nav model", () => {
  it("agents never see admin-only leaves or Home", () => {
    for (const role of ["confirmation_agent", "delivery_agent"] as const) {
      expect(visibleNav(role).home).toBeNull();
      expect(navLeaves(role).some((l) => l.adminOnly)).toBe(false);
    }
  });
  it("each agent sees only their queue", () => {
    expect(navLeaves("confirmation_agent").map((l) => l.key)).toEqual(["confirmation"]);
    expect(navLeaves("delivery_agent").map((l) => l.key)).toEqual(["shipping"]);
  });
  it("no role shows nothing", () => {
    expect(navLeaves(null)).toEqual([]);
  });
  it("admin sees every non-empty group, empty groups dropped", () => {
    const { home, groups } = visibleNav("admin");
    expect(home?.href).toBe(HOME.href);
    expect(groups.map((g) => g.key)).toEqual(
      GROUPS.filter((g) => g.items.length).map((g) => g.key),
    );
    expect(groups.every((g) => g.items.length > 0)).toBe(true);
  });
  it("hrefs are unique", () => {
    const hrefs = navLeaves("admin").map((l) => l.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
  it("every nav/navOld key exists in en and ar", () => {
    const keys = [
      ...GROUPS.map((g) => `nav.${g.key}`),
      ...navLeaves("admin").flatMap((l) => [`nav.${l.key}`, ...(l.oldKey ? [`navOld.${l.oldKey}`] : [])]),
    ];
    const get = (m: unknown, k: string) =>
      k.split(".").reduce<unknown>((o, p) => (o as Record<string, unknown> | undefined)?.[p], m);
    for (const k of keys) {
      expect(get(en, k), `en ${k}`).toBeTypeOf("string");
      expect(get(ar, k), `ar ${k}`).toBeTypeOf("string");
    }
  });
  it("admin palette values and labels are unique", () => {
    const leaves = navLeaves("admin");
    expect(new Set(leaves.map((l) => l.href)).size).toBe(leaves.length);
    const labels = leaves.map((l) => l.key);
    expect(new Set(labels).size).toBe(labels.length);
  });
  it("activeLeafHref resolves exactly one leaf by longest prefix", () => {
    const a = (p: string) => activeLeafHref("admin", p);
    expect(a("/app/contacts/suppliers")).toBe("/app/contacts/suppliers");
    expect(a("/app/contacts")).toBe("/app/contacts");
    expect(a("/app/products/planner")).toBe("/app/products/planner");
    expect(a("/app/products")).toBe("/app/products");
    expect(a("/app/orders/123")).toBe("/app/orders/all");
    expect(a("/app/orders/new")).toBe("/app/orders/all");
    expect(a("/app/orders/cash")).toBe("/app/orders/cash");
    expect(a("/app/orders/confirmation")).toBe("/app/orders/confirmation");
  });
  it("parseClosedGroups tolerates corrupt values", () => {
    expect(parseClosedGroups(null)).toEqual({});
    expect(parseClosedGroups("{bad")).toEqual({});
    expect(parseClosedGroups("[1]")).toEqual({});
    expect(parseClosedGroups('{"a":true,"b":3}')).toEqual({ a: true });
  });
  it("settings group starts collapsed", () => {
    expect(GROUPS.find((g) => g.key === "groupSettings")?.defaultClosed).toBe(true);
  });
});
