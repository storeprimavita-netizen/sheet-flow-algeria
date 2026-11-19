import { describe, expect, test } from "vitest";

import { drillChips, parseDrillFilters } from "./drill-filters";

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
