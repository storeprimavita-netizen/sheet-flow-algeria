import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

import { paletteFilter } from "@/lib/palette-filter";
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
