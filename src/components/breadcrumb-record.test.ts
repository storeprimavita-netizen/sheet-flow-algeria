import { describe, expect, test } from "vitest";
import { nextRecord } from "./breadcrumb-record";

describe("nextRecord", () => {
  test("same record on the same path returns the previous object", () => {
    const prev = nextRecord(null, { label: "A", href: "/x" }, "/p");
    expect(nextRecord(prev, { label: "A", href: "/x" }, "/p")).toBe(prev);
  });
  test("clearing an empty record returns null unchanged", () => {
    expect(nextRecord(null, null, "/p")).toBeNull();
    expect(nextRecord({ label: "A", path: "/p" }, null, "/p")).toBeNull();
  });
  test("a new path or label yields new state", () => {
    const prev = nextRecord(null, { label: "A" }, "/p");
    expect(nextRecord(prev, { label: "A" }, "/q")).not.toBe(prev);
    expect(nextRecord(prev, { label: "B" }, "/p")).toEqual({ label: "B", path: "/p" });
  });
});
