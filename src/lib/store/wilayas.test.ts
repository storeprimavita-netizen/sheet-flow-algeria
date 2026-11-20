import { expect, test } from "vitest";

import { WILAYAS } from "./wilayas";

test("58 numbered wilayas, 16 is Algiers", () => {
  expect(WILAYAS).toHaveLength(58);
  expect(WILAYAS[15]).toEqual({ code: 16, name: "الجزائر" });
  expect(WILAYAS[57].code).toBe(58);
});
