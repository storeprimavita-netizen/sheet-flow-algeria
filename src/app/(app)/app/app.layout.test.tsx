import { beforeEach, describe, expect, test, vi } from "vitest";

const from = vi.fn();
const getProfile = vi.fn();
const getStatusLabelOverrides = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from }) }));
vi.mock("@/lib/rbac", () => ({
  getUser: async () => ({ id: "u", email: "a@b.dz" }),
  getProfile: () => getProfile(),
}));
vi.mock("@/lib/status-labels", () => ({ getStatusLabelOverrides: () => getStatusLabelOverrides() }));
vi.mock("@/components/app-shell", () => ({ AppShell: () => null }));
vi.mock("@/components/status-labels-provider", () => ({ StatusLabelsProvider: () => null }));

import AppLayout from "./layout";

beforeEach(() => {
  from.mockReset();
  getProfile.mockReset();
  getStatusLabelOverrides.mockReset();
});

describe("AppLayout", () => {
  for (const why of ["no row", "inactive", "no workspace"]) {
    test(`${why} -> /no-access`, async () => {
      getProfile.mockResolvedValue(null); // getProfile maps all three to null (see rbac.test.ts)
      await expect(AppLayout({ children: null })).rejects.toThrow("redirect:/no-access");
      expect(from).not.toHaveBeenCalled();
      expect(getStatusLabelOverrides).not.toHaveBeenCalled();
    });
  }
});
