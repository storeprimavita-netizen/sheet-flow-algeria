import { describe, expect, test, vi } from "vitest";

const from = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from }) }));

import { getStatusLabelOverrides } from "@/lib/status-labels";

describe("getStatusLabelOverrides", () => {
  test("a thrown fetch gives {}", async () => {
    from.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    expect(await getStatusLabelOverrides()).toEqual({});
  });
  test("an error or no session gives {}", async () => {
    from.mockReturnValueOnce({ select: async () => ({ data: null, error: { message: "x" } }) });
    expect(await getStatusLabelOverrides()).toEqual({});
  });
  test("unknown kinds, stale keys and prototype keys are dropped", async () => {
    from.mockReturnValueOnce({
      select: async () => ({
        data: [
          { kind: "confirmation", status_key: "confirmed", label_en: "OK", label_ar: null },
          { kind: "confirmation", status_key: "removed_status", label_en: "x", label_ar: null },
          { kind: "__proto__", status_key: "a", label_en: "x", label_ar: null },
          { kind: "delivery", status_key: "__proto__", label_en: "x", label_ar: null },
        ],
        error: null,
      }),
    });
    expect(await getStatusLabelOverrides()).toEqual({ confirmation: { confirmed: { en: "OK", ar: null } } });
  });
});
