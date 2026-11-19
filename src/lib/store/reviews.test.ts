import { describe, expect, test } from "vitest";

import { isVerifiedOrder, publicReviewName } from "./reviews";

describe("publicReviewName", () => {
  test("first name + initial, never the full name", () => {
    expect(publicReviewName("Amina Benali")).toBe("Amina B.");
    expect(publicReviewName("Amina Bent Ali")).toBe("Amina A.");
    expect(publicReviewName("  Amina  ")).toBe("Amina");
    expect(publicReviewName("أمينة بن علي")).toBe("أمينة ع.");
  });
  test("hyphen, dot, no-break and zero-width separators never leak the full name", () => {
    expect(publicReviewName("Amina-Benali")).toBe("Amina B.");
    expect(publicReviewName("Amina.Benali")).toBe("Amina B.");
    expect(publicReviewName("Amina\u00A0Benali")).toBe("Amina B.");
    expect(publicReviewName("Amina\u200BBenali")).toBe("Amina B.");
  });
  test("a single long token is truncated", () => {
    expect(publicReviewName("Abcdefghijklmnopqrstuvwxyz")).toBe("Abcdefghijkl");
  });
  test("emoji stripped, empty stays empty", () => {
    expect(publicReviewName("Amina ✨ Benali 💖")).toBe("Amina B.");
    expect(publicReviewName("✨💖")).toBe("");
  });
});

describe("isVerifiedOrder", () => {
  const ok = { product_id: "p1", confirmation_status: "confirmed", excluded_reason: null };
  test("only same product, confirmed, not excluded", () => {
    expect(isVerifiedOrder(ok, "p1")).toBe(true);
    expect(isVerifiedOrder(ok, "p2")).toBe(false);
    expect(isVerifiedOrder({ ...ok, excluded_reason: "test" }, "p1")).toBe(false);
    expect(isVerifiedOrder({ ...ok, confirmation_status: "cancelled" }, "p1")).toBe(false);
    expect(isVerifiedOrder(null, "p1")).toBe(false);
  });
});
