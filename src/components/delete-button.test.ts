import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));

import { runDelete } from "./delete-button";

const msgs = { failed: "Delete failed", inUse: "In use" };

describe("runDelete (action path)", () => {
  test("a failing action returns the error message and no success", async () => {
    const action = vi.fn().mockResolvedValue({ ok: false });
    expect(await runDelete({ id: "1", action }, msgs)).toEqual({ ok: false, message: "Delete failed" });
    expect(action).toHaveBeenCalledWith("1");
  });
  test("a succeeding action is ok", async () => {
    expect(await runDelete({ id: "1", action: async () => ({ ok: true }) }, msgs)).toEqual({ ok: true });
  });
});
