import { describe, expect, test } from "vitest";

import { defaultFormFields, formFieldsSchema, normalizeFormFields, parseDeliveryMethods, parseFormFields } from "./form-fields";

describe("form fields", () => {
  test("invalid fields jsonb renders defaults", () => {
    for (const raw of [null, {}, "x", [{ type: "weird" }], [{ type: "core", key: "name", required: true, enabled: true, extra: 1 }]]) {
      expect(parseFormFields(raw)).toEqual(defaultFormFields());
    }
  });
  test("core fields are forced present, enabled and required", () => {
    const f = normalizeFormFields([{ type: "core", key: "phone", required: false, enabled: false, label: "Mobile" }]);
    const phone = f.find((x) => x.key === "phone")!;
    expect(phone).toMatchObject({ required: true, enabled: true, label: "Mobile" });
    expect(f.filter((x) => x.type === "core")).toHaveLength(7);
  });
  test("at most 5 custom fields, unique keys", () => {
    const many = ["c1", "c1", "c2", "c3", "c4", "c5"].map((key) => ({ type: "text" as const, key, label: key, required: false, enabled: true }));
    expect(normalizeFormFields(many).filter((x) => x.type !== "core")).toHaveLength(5);
    const six = [...many, { type: "text" as const, key: "c6", label: "x", required: false, enabled: true }];
    expect(formFieldsSchema.safeParse(six).success).toBe(false);
  });
  test("labels: no HTML, no emoji, <= 60", () => {
    const f = (label: string) => formFieldsSchema.safeParse([{ type: "text", key: "c1", label, required: false, enabled: true }]).success;
    expect(f("Taille du bras")).toBe(true);
    expect(f("<b>x</b>")).toBe(false);
    expect(f("Color 🎨")).toBe(false);
    expect(f("x".repeat(61))).toBe(false);
    expect(f("   ")).toBe(false);
  });
  test("select needs 2..10 plain options", () => {
    const s = (options: string[]) => formFieldsSchema.safeParse([{ type: "select", key: "c1", label: "L", required: true, enabled: true, options }]).success;
    expect(s(["a"])).toBe(false);
    expect(s(["a", "b"])).toBe(true);
    expect(s(Array.from({ length: 11 }, (_, i) => `o${i}`))).toBe(false);
  });
  test("delivery methods fall back to both", () => {
    expect(parseDeliveryMethods(["home"])).toEqual(["home"]);
    expect(parseDeliveryMethods([])).toEqual(["home", "stopdesk"]);
    expect(parseDeliveryMethods(["air"])).toEqual(["home", "stopdesk"]);
  });
});
