import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { GROUPS, MY_DAY, bottomBar, activeBarHref, groupCounterTotal, HOME, activeLeafHref, crumbsFor, orderHome, navLeaves, purposeKey, parseClosedGroups, visibleNav } from "@/components/nav-model";
import en from "@/messages/en.json";
import ar from "@/messages/ar.json";

describe("nav model", () => {
  it("agent home is My day", () => {
    for (const role of ["confirmation_agent", "delivery_agent"] as const) expect(visibleNav(role).home).toBe(MY_DAY);
    expect(MY_DAY.href).toBe("/app/my-day");
    expect(visibleNav("admin").home).toBe(HOME);
  });
  it("bottom bar per role has <=4 items + More", () => {
    for (const role of ["admin", "confirmation_agent", "delivery_agent"] as const) expect(bottomBar(role).length).toBeLessThanOrEqual(4);
    expect(bottomBar(null)).toEqual([]);
    expect(bottomBar("confirmation_agent").map((l) => l.key)).toEqual(["myDay", "confirmation"]);
    expect(bottomBar("delivery_agent").map((l) => l.key)).toEqual(["myDay", "shipping"]);
  });
  it("bottom bar never links an adminOnly page for agents (no Tasks)", () => {
    for (const role of ["confirmation_agent", "delivery_agent"] as const) {
      const bar = bottomBar(role);
      expect(bar.some((l) => l.adminOnly)).toBe(false);
      expect(bar.some((l) => l.href.startsWith("/app/team"))).toBe(false);
    }
  });
  it("admin bar = Home/Confirmation/Orders/Money", () => {
    expect(bottomBar("admin").map((l) => l.href)).toEqual(["/app/dashboard", "/app/sell/confirmation", "/app/sell/orders", "/app/money"]);
    expect(activeBarHref("admin", "/app/money/expenses")).toBe("/app/money");
    expect(activeBarHref("admin", "/app/catalog/stock")).toBeUndefined();
    expect(activeBarHref("delivery_agent", "/app/my-day")).toBe("/app/my-day");
  });
  it("agents never see admin-only leaves or the admin Home", () => {
    for (const role of ["confirmation_agent", "delivery_agent"] as const) {
      expect(visibleNav(role).home).not.toBe(HOME);
      expect(navLeaves(role).some((l) => l.adminOnly)).toBe(false);
    }
  });
  it("each agent sees only their queue", () => {
    expect(navLeaves("confirmation_agent").map((l) => l.key)).toEqual(["myDay", "confirmation"]);
    expect(navLeaves("delivery_agent").map((l) => l.key)).toEqual(["myDay", "shipping"]);
  });
  it("statistics: admin-only, in Sell right after customers, never in an agent menu", () => {
    const sell = GROUPS.find((g) => g.key === "groupSell")!.items.map((l) => l.key);
    expect(sell.indexOf("statistics")).toBe(sell.indexOf("customers") + 1);
    expect(navLeaves("admin").find((l) => l.key === "statistics")?.adminOnly).toBe(true);
    for (const role of ["confirmation_agent", "delivery_agent"] as const)
      expect(navLeaves(role).some((l) => l.key === "statistics")).toBe(false);
    expect(activeLeafHref("admin", "/app/statistics")).toBe("/app/statistics");
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
    expect(a("/app/money/suppliers")).toBe("/app/money/suppliers");
    expect(a("/app/sell/customers")).toBe("/app/sell/customers");
    expect(a("/app/catalog/pricing")).toBe("/app/catalog/pricing");
    expect(a("/app/catalog/products")).toBe("/app/catalog/products");
    expect(a("/app/sell/orders/123")).toBe("/app/sell/orders");
    expect(a("/app/sell/orders/new")).toBe("/app/sell/orders");
    expect(a("/app/money/courier-cash")).toBe("/app/money/courier-cash");
    expect(a("/app/sell/confirmation")).toBe("/app/sell/confirmation");
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

describe("nav model (round 4)", () => {
  it("every nav href maps to an existing page.tsx", () => {
    for (const l of navLeaves("admin")) {
      // Page sits in the href folder or in a route group (e.g. sell/orders/(list)).
      const dir = path.join(process.cwd(), "src/app/(app)", l.href.split("?")[0]);
      const groups = existsSync(dir) ? readdirSync(dir).filter((n) => n.startsWith("(")) : [];
      const hit = [dir, ...groups.map((g) => path.join(dir, g))].some((d) => existsSync(path.join(d, "page.tsx")));
      expect(hit, l.href).toBe(true);
    }
  });
  it("no nav href uses an old prefix", () => {
    for (const l of navLeaves("admin")) {
      expect(l.href, l.href).not.toMatch(/^\/app\/(orders|contacts|products|stock|pricing|finance)(\/|$|\?)/);
    }
  });
  it("agent leaves: My day then their queue", () => {
    expect(navLeaves("confirmation_agent").map((l) => l.href)).toEqual(["/app/my-day", "/app/sell/confirmation"]);
    expect(navLeaves("delivery_agent").map((l) => l.href)).toEqual(["/app/my-day", "/app/sell/shipping"]);
  });
  it("agents get exactly one Sell group", () => {
    for (const role of ["confirmation_agent", "delivery_agent"] as const) {
      const { groups } = visibleNav(role);
      expect(groups.map((g) => g.key)).toEqual(["groupSell"]);
      expect(groups[0].items).toHaveLength(1);
    }
  });
  it("palette keywords: Delivery and Shipping hit one item, Cash finds Courier cash", () => {
    const kw = (key: string) => {
      const l = navLeaves("admin").find((x) => x.key === key)!;
      return [en.nav[l.key as keyof typeof en.nav], ...(l.oldKey ? [en.navOld[l.oldKey as keyof typeof en.navOld]] : [])];
    };
    const find = (q: string) =>
      navLeaves("admin").filter((l) => kw(l.key).some((k) => k.toLowerCase().includes(q.toLowerCase())));
    expect(find("Delivery").map((l) => l.key)).toEqual(["shipping"]);
    expect(find("Shipping").map((l) => l.key)).toEqual(["shipping"]);
    expect(find("Cash").map((l) => l.key)).toContain("courierCash");
  });
  it("settings: overview first, distinct icons", () => {
    const items = GROUPS.find((g) => g.key === "groupSettings")!.items;
    expect(items[0].key).toBe("settingsOverview");
    const icons = navLeaves("admin").map((l) => l.icon);
    expect(new Set(icons).size).toBe(icons.length);
  });
});

describe("nav model (round 5)", () => {
  it("collapsed header counter sums the group's counters", () => {
    const sell = GROUPS.find((g) => g.key === "groupSell")!;
    const team = GROUPS.find((g) => g.key === "groupTeam")!;
    const counts = { confirmation: 3, delivery: 4, tasks: 5 };
    expect(groupCounterTotal(sell, counts)).toBe(7);
    expect(groupCounterTotal(team, counts)).toBe(5);
    expect(groupCounterTotal(GROUPS.find((g) => g.key === "groupSettings")!, counts)).toBe(0);
  });
});

describe("app shell (D32, review-4)", () => {
  const src = readFileSync(path.join(process.cwd(), "src/components/app-shell.tsx"), "utf8");
  it("nav components are module-level (inner components remount the nav and drop focus)", () => {
    const body = src.slice(src.indexOf("export function AppShell"));
    expect(body).not.toMatch(/^\s+function (Counter|Leaf|Group)\(/m);
    for (const c of ["Counter", "Leaf", "Group"]) expect(src).toMatch(new RegExp(`^function ${c}\\(`, "m"));
  });
  it("Settings is one pinned row labelled Settings, outside the scrolling nav", () => {
    expect(src).toContain('t("nav.groupSettings")');
    expect(src.indexOf("{settingsRow}")).toBeGreaterThan(src.indexOf("{nav}"));
    expect(src).not.toMatch(/bottomGroups\.map/);
  });
  it("phone touch targets are at least 44px", () => {
    expect(src.match(/max-md:min-h-11/g)?.length).toBeGreaterThanOrEqual(2);
  });
  it("D33: edge fades are token-coloured, click-through, and the active group title is a plain label", () => {
    expect(src).toContain("pointer-events-none");
    expect(src).toContain("from-surface");
    expect(src).toContain("onScroll={measure}");
    expect(src).toContain("ResizeObserver");
    expect(src).toMatch(/hasActive \? \(\s*<div className=\{headerClass\}>/);
    expect(src).not.toContain("aria-disabled");
  });
  it("collapsed group counter is announced with the group name, en + ar", () => {
    expect(src).toContain('t("nav.groupPending"');
    expect(en.nav.groupPending).toContain("{n}");
    expect(ar.nav.groupPending).toContain("{n}");
  });
  it("palette search never matches the page address; no role means no brand link", () => {
    const pal = readFileSync(path.join(process.cwd(), "src/components/command-palette.tsx"), "utf8");
    expect(pal).not.toMatch(/value=\{`[^`]*n\.href/);
    expect(src).not.toContain('?? "/app"');
  });
  it("palette search value has no i18n key", () => {
    const pal = readFileSync(path.join(process.cwd(), "src/components/command-palette.tsx"), "utf8");
    expect(pal).not.toMatch(/value=\{`[^`]*n\.key/);
  });
  it("group+label unique per role", () => {
    const nav = en.nav as Record<string, string>;
    for (const role of ["admin", "confirmation_agent", "delivery_agent"] as const) {
      const { home, groups } = visibleNav(role);
      const labels = [
        ...(home ? [nav[home.key]] : []),
        ...groups.flatMap((g) => g.items.map((i) => `${nav[g.key]} ${nav[i.key]}`)),
      ];
      expect(new Set(labels).size).toBe(labels.length);
    }
  });
  it("drawer closes on Escape, is inert when closed, is a labelled dialog, brand row is 44px", () => {
    expect(src).toContain('e.key === "Escape"');
    expect(src).toContain("inert={!open && !isDesktop}");
    expect(src).toContain("inert={open && !isDesktop}"); // page behind the modal drawer is inert
    expect(src).toContain('role: "dialog"');
    expect(src).toContain('"aria-modal": true');
    expect(src).toContain("toggleRef.current?.focus()");
    expect(src).toMatch(/brandClass = "[^"]*max-md:min-h-11/);
  });
  it("crumbsFor admin /app/money/expenses → Money › Expenses", () => {
    expect(crumbsFor("admin", "/app/money/expenses")).toEqual([
      { labelKey: "nav.groupMoney", href: "/app/money" },
      { labelKey: "nav.expenses", href: "/app/money/expenses" },
    ]);
  });
  it("detail path /app/sell/orders/<id> → Sell › All orders", () => {
    expect(crumbsFor("admin", "/app/sell/orders/abc").map((c) => c.labelKey)).toEqual(["nav.groupSell", "nav.all"]);
    expect(crumbsFor("admin", "/app/sell/orders/new").map((c) => c.labelKey)).toEqual(["nav.groupSell", "nav.all", "nav.newRecord"]);
  });
  it("agent on an order record gets a path back to their own queue", () => {
    const c = crumbsFor("confirmation_agent", "/app/sell/orders/abc");
    expect(c.map((x) => x.labelKey)).toEqual(["nav.groupSell", "nav.confirmation"]);
    expect(c[1].href).toBe("/app/sell/confirmation");
    expect(c[0].href).toBeUndefined();
    const d = crumbsFor("delivery_agent", "/app/sell/orders/abc");
    expect(d.map((x) => x.labelKey)).toEqual(["nav.groupSell", "nav.shipping"]);
    expect(d[1].href).toBe("/app/sell/shipping");
  });
  it("hubs show the group only; home shows none", () => {
    expect(crumbsFor("admin", "/app/money").map((c) => c.labelKey)).toEqual(["nav.groupMoney"]);
    expect(crumbsFor("admin", "/app/store").map((c) => c.labelKey)).toEqual(["nav.groupStore"]);
    expect(crumbsFor("admin", "/app/dashboard")).toEqual([]);
  });
  it("agent never gets an admin crumb or hub item", () => {
    expect(crumbsFor("confirmation_agent", "/app/money/expenses")).toEqual([]);
    expect(crumbsFor("confirmation_agent", "/app/money")).toEqual([]);
    expect(crumbsFor("confirmation_agent", "/app/sell").length).toBe(1);
    expect(visibleNav("confirmation_agent").groups[0].items.map((l) => l.key)).toEqual(["confirmation"]);
  });
  it("every leaf has purposeKey present in en and ar", () => {
    const get = (m: unknown, k: string) =>
      k.split(".").reduce<unknown>((o, p) => (o as Record<string, unknown> | undefined)?.[p], m);
    for (const l of navLeaves("admin")) {
      expect(get(en, purposeKey(l)), `en ${l.key}`).toBeTypeOf("string");
      expect(get(ar, purposeKey(l)), `ar ${l.key}`).toBeTypeOf("string");
    }
  });
});

describe("orderHome", () => {
  it("orderHome is the role's own queue, All orders for admin", () => {
    expect(orderHome("admin").href).toBe("/app/sell/orders");
    expect(orderHome("confirmation_agent").key).toBe("confirmation");
    expect(orderHome("delivery_agent").key).toBe("shipping");
    expect(orderHome(null).key).toBe("all");
  });
});
