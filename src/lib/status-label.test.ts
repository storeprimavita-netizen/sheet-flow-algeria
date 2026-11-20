import { describe, expect, test } from "vitest";

import { resolveStatusLabel, type StatusLabelOverrides } from "@/lib/status-label";

const o: StatusLabelOverrides = { confirmation: { confirmed: { en: "OK", ar: null } } };

describe("resolveStatusLabel", () => {
  test("en and ar never leak into each other", () => {
    expect(resolveStatusLabel(o, "confirmation", "confirmed", "en", "Confirmed")).toBe("OK");
    expect(resolveStatusLabel(o, "confirmation", "confirmed", "ar", "مؤكد")).toBe("مؤكد");
    expect(resolveStatusLabel(o, "confirmation", "confirmed", "fr", "x")).toBe("x");
  });
  test("fallback for no overrides, unknown kind or key, and prototype keys", () => {
    expect(resolveStatusLabel(undefined, "delivery", "shipped", "en", "F")).toBe("F");
    expect(resolveStatusLabel(o, "delivery", "shipped", "en", "F")).toBe("F");
    expect(resolveStatusLabel(o, "confirmation", "pending", "en", "F")).toBe("F");
    expect(resolveStatusLabel(o, "confirmation", "__proto__", "en", "F")).toBe("F");
    expect(resolveStatusLabel(o, "confirmation", "constructor", "en", "F")).toBe("F");
    expect(resolveStatusLabel(o, "__proto__" as never, "x", "en", "F")).toBe("F");
  });
  test("special characters round-trip exactly", () => {
    const t = `'' {x} <i> #`;
    expect(resolveStatusLabel({ task: { done: { en: t, ar: null } } }, "task", "done", "en", "F")).toBe(t);
  });
});
