import { describe, expect, test } from "vitest";

import en from "@/messages/en.json";
import ar from "@/messages/ar.json";
import { buildDrillLabels, drillChips, inDrillMode, parseDrillFilters } from "./drill-filters";

const U = "0b9f4a3c-1111-4222-8333-444455556666";
const params = (o: Record<string, string>) => (k: string) => o[k] ?? "";
const labels = {
  category: "Category",
  agent: "Agent",
  deliveryType: "Delivery type",
  selected: "Selected",
  deliveryTypeNames: { home: "Home", stopdesk: "Stop desk" },
  categories: [{ value: U, label: "Abayas" }],
  agents: [],
};

describe("parseDrillFilters", () => {
  test("uppercase uuid is kept, lowercased", () => {
    const { filters, dropped } = parseDrillFilters(params({ category: U.toUpperCase(), conf_agent: U.toUpperCase() }));
    expect(filters.category).toBe(U);
    expect(filters.confAgent).toBe(U);
    expect(dropped).toEqual([]);
  });
  test("home and stopdesk are kept", () => {
    expect(parseDrillFilters(params({ delivery_type: "home" })).filters.deliveryType).toBe("home");
    expect(parseDrillFilters(params({ delivery_type: "stopdesk" })).filters.deliveryType).toBe("stopdesk");
  });
  test("pickup and a non-uuid category are dropped and reported", () => {
    const { filters, dropped } = parseDrillFilters(params({ delivery_type: "pickup", category: "nope" }));
    expect(filters.deliveryType).toBe("");
    expect(filters.category).toBe("");
    expect(dropped).toEqual(["category", "delivery_type"]);
  });
});

describe("drillChips", () => {
  test("known category and translated delivery type", () => {
    const chips = drillChips({ category: U, confAgent: "", deliveryType: "stopdesk" }, labels);
    expect(chips).toEqual([
      { key: "category", label: "Category: Abayas" },
      { key: "delivery_type", label: "Delivery type: Stop desk" },
    ]);
  });
  test("unknown category and agent fall back to Selected, never the id", () => {
    const chips = drillChips({ category: "9b9f4a3c-1111-4222-8333-444455556666", confAgent: U, deliveryType: "" }, labels);
    expect(chips.map((c) => c.label)).toEqual(["Category: Selected", "Agent: Selected"]);
  });
});

describe("more drill filter cases", () => {
  test("uppercase uuid gives same chips", () => {
    const up = parseDrillFilters(params({ category: U.toUpperCase() })).filters;
    const low = parseDrillFilters(params({ category: U })).filters;
    expect(drillChips(up, labels)).toEqual(drillChips(low, labels));
  });
  test("conf_agent that is not a uuid is dropped and reported", () => {
    const { filters, dropped } = parseDrillFilters(params({ conf_agent: "x" }));
    expect(filters.confAgent).toBe("");
    expect(dropped).toEqual(["conf_agent"]);
  });
  test("a repeated delivery_type is ignored with the dropped note", () => {
    const { filters, dropped } = parseDrillFilters(params({}), ["delivery_type"]);
    expect(filters.deliveryType).toBe("");
    expect(dropped).toEqual(["delivery_type"]);
  });
  test("unknown delivery key falls back to Selected", () => {
    expect(drillChips({ category: "", confAgent: "", deliveryType: "pickup" }, labels)[0].label).toBe("Delivery type: Selected");
  });
  test("dropped-only state has no chips", () => {
    const { filters, dropped } = parseDrillFilters(params({ delivery_type: "pickup" }));
    expect(drillChips(filters, labels)).toEqual([]);
    expect(dropped.length).toBe(1);
  });
  test("inDrillMode is true only with drill params", () => {
    expect(inDrillMode(new URLSearchParams("drill=received"))).toBe(true);
    expect(inDrillMode(new URLSearchParams("category=x&wilaya_code=1"))).toBe(false);
  });
  test.each([["en", en], ["ar", ar]] as const)("bar label keys exist in %s", (_n, msgs) => {
    const t = (key: string) => {
      const v = key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], msgs);
      if (typeof v !== "string") throw new Error(`missing message ${key}`);
      return v;
    };
    const l = buildDrillLabels(t, [], []);
    expect(Object.values(l.deliveryTypeNames).every(Boolean)).toBe(true);
    expect(l.selected).toBeTruthy();
  });
});
