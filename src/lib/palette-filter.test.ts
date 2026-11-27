import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

import { paletteFilter, hasPaletteMatch } from "@/lib/palette-filter";
import { navLeaves } from "@/components/nav-model";
import en from "@/messages/en.json";
import ar from "@/messages/ar.json";

const src = (p: string) => readFileSync(p, "utf8");

describe("palette filter", () => {
  it("hides non-substrings and shows substrings case-insensitively", () => {
    expect(paletteFilter("Finance Overview", "ad")).toBe(0);
    expect(paletteFilter("Finance Ad spend", "AD S")).toBe(1);
    expect(paletteFilter("anything", "")).toBe(1);
  });
  it("short Arabic query matches only containing rows", () => {
    expect(paletteFilter(`${ar.nav.groupSell} ${ar.nav.orders}`, "طلب")).toBe(1);
    expect(paletteFilter(`${ar.nav.groupSell} ${ar.nav.tasks}`, "طلب")).toBe(0);
  });
  it("normalizes alef, ta marbuta and tashkeel", () => {
    expect(paletteFilter("إدارة", "ادارة")).toBe(1);
    expect(paletteFilter("مدرسه", "مدرسة")).toBe(1);
    expect(paletteFilter("طَلَب", "طلب")).toBe(1);
  });
  it("internal keys do not match; old-name keywords do", () => {
    expect(paletteFilter("Finance Overview", "financeOverview")).toBe(0);
    expect(paletteFilter("Finance Overview", "ad spend", ["Ad spend"])).toBe(1);
  });
});

describe("NAV-1-H filter", () => {
  it("Arabic old-name keyword matches", () => {
    expect(paletteFilter(`${ar.nav.groupSell} ${ar.nav.shipping}`, "التوصيل", [ar.navOld.delivery])).toBe(1);
  });
  it("group-only query matches", () => {
    expect(paletteFilter(`${ar.nav.groupSell} ${ar.nav.customers}`, ar.nav.groupSell)).toBe(1);
    expect(paletteFilter(`${en.nav.groupSell} ${en.nav.customers}`, en.nav.groupSell)).toBe(1);
  });
  it("nonsense EN query hides every real nav row", () => {
    const rows = navLeaves("admin").map((l) => ({
      value: en.nav[l.key as keyof typeof en.nav] as string,
      keywords: l.oldKey ? [en.navOld[l.oldKey as keyof typeof en.navOld] as string] : [],
    }));
    expect(rows.length).toBeGreaterThan(5);
    const actionRows = [en.cmd.newOrder, en.cmd.addAdSpend].map((value) => ({ value }));
    expect(hasPaletteMatch([...rows, ...actionRows], "zzzz")).toBe(false);
    expect(hasPaletteMatch(rows, "")).toBe(true);
  });
  it("طلب against real AR labels", () => {
    expect(paletteFilter(ar.nav.all, "طلب")).toBe(1);
    expect(paletteFilter(ar.cmd.newOrder, "طلب")).toBe(1);
    expect(paletteFilter(ar.nav.tasks, "طلب")).toBe(0);
  });
  it("Persian yeh and keheh fold", () => {
    expect(paletteFilter("\u064A\u0643", "\u06CC\u06A9")).toBe(1);
    expect(paletteFilter("\u06CC\u06A9", "\u064A\u0643")).toBe(1);
  });
  it("filter source is ASCII inside its regexes", () => {
    const code = src("src/lib/palette-filter.ts");
    expect(code).not.toMatch(
      /[\u0300-\u036F\u0640\u064B-\u065F\u0670\u06CC\u06A9\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/,
    );
  });
  it("hasPaletteMatch is true when only a keyword matches", () => {
    expect(hasPaletteMatch([{ value: "Finance", keywords: ["Ad spend"] }], "ad spend")).toBe(true);
    expect(hasPaletteMatch([{ value: "Finance" }], "ad spend")).toBe(false);
  });
});

describe("NAV-1-H palette source", () => {
  it("uses hasPaletteMatch and cmd.noNavMatch", () => {
    const code = src("src/components/command-palette.tsx");
    expect(code).toContain("hasPaletteMatch");
    expect(code).toContain("cmd.noNavMatch");
  });
});

describe("NAV-1-G sources", () => {
  it("nav.menu exists in both locales", () => {
    expect(en.nav.menu).toBeTruthy();
    expect(ar.nav.menu).toBeTruthy();
  });
  it("tabIndex is conditional and kbd are ltr", () => {
    expect(src("src/components/app-shell.tsx")).toContain("tabIndex={open && !isDesktop ? -1 : undefined}");
    expect(src("src/components/app-shell.tsx")).toMatch(/<kbd dir="ltr"/);
    expect((src("src/components/command-palette.tsx").match(/<kbd dir="ltr"/g) ?? []).length).toBe(2);
  });
});
