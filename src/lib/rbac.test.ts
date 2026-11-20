import { beforeEach, describe, expect, test, vi } from "vitest";

const redirect = vi.fn((to: string) => {
  throw new Error(`REDIRECT:${to}`);
});
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) }));
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(f: T) => f }));

let user: { id: string } | null = { id: "u1" };
let row: unknown = null;
let rowError: { message: string } | null = null;
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user } }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => (rowError ? { data: null, error: rowError } : { data: row, error: null }) }) }),
    }),
  }),
}));

import { getProfile, requireProfile } from "./rbac";

describe("getProfile", () => {
  beforeEach(() => {
    user = { id: "u1" };
    row = null;
    rowError = null;
    redirect.mockClear();
  });
  test("null for no row", async () => expect(await getProfile()).toBeNull());
  test("null for inactive", async () => {
    row = { role: "admin", workspace_id: "w", is_active: false };
    expect(await getProfile()).toBeNull();
  });
  test("null for no workspace", async () => {
    row = { role: "admin", workspace_id: null, is_active: true };
    expect(await getProfile()).toBeNull();
  });
  test("null for query error", async () => {
    rowError = { message: "boom" };
    expect(await getProfile()).toBeNull();
  });
  test("profile for active row", async () => {
    row = { role: "admin", workspace_id: "w", is_active: true };
    expect(await getProfile()).toEqual({ role: "admin", workspaceId: "w" });
  });
  test("requireProfile redirects to /no-access", async () => {
    await expect(requireProfile()).rejects.toThrow("REDIRECT:/no-access");
  });
  test("requireProfile returns the profile", async () => {
    row = { role: "admin", workspace_id: "w", is_active: true };
    expect((await requireProfile()).workspaceId).toBe("w");
  });
});
