import { describe, expect, test } from "vitest";
import { syncedValue } from "./search-param-input";

describe("syncedValue", () => {
  test("keeps typed text (with trailing space) when the URL echoes it", () => {
    expect(syncedValue("Amina ", "Amina")).toBe("Amina ");
  });
  test("clears the box when a view switch or Reset empties the URL value", () => {
    expect(syncedValue("Amina", "")).toBe("");
  });
  test("adopts another view's value", () => {
    expect(syncedValue("Amina", "Karim")).toBe("Karim");
  });
});
