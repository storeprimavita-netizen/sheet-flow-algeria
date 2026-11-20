import { describe, expect, it } from "vitest";

import { csvSuccessToast } from "./fees-csv-toast";

describe("csvSuccessToast", () => {
  it("commune-only file reports communes", () => {
    expect(csvSuccessToast(0, 3)).toEqual({ key: "successCommunes", count: 3 });
  });
  it("mixed file reports fee changes", () => {
    expect(csvSuccessToast(2, 3)).toEqual({ key: "success", count: 2 });
  });
  it("nothing changed reports zero prices", () => {
    expect(csvSuccessToast(0, 0)).toEqual({ key: "success", count: 0 });
  });
});
