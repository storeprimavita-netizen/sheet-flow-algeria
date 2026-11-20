import { describe, expect, test, vi } from "vitest";

const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({ notFound: () => notFound() }));

import UnmatchedAppRoute from "./page";

describe("app catch-all", () => {
  test("catch-all route calls notFound", () => {
    expect(() => UnmatchedAppRoute()).toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
  });
});
