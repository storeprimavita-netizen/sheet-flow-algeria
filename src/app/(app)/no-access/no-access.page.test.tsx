import { isValidElement, type ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const getUser = vi.fn();
const getProfile = vi.fn();
vi.mock("@/lib/rbac", () => ({ getUser: () => getUser(), getProfile: () => getProfile() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (k: string) => `t:${k}` }));
vi.mock("@/components/locale-switcher", () => ({ LocaleSwitcher: () => null }));
vi.mock("@/components/sign-out-button", () => ({ SignOutButton: () => null }));

import NoAccessPage from "./page";
import { SignOutButton } from "@/components/sign-out-button";
import { LocaleSwitcher } from "@/components/locale-switcher";

function find(node: ReactNode, pred: (p: Record<string, unknown>, type: unknown) => boolean): boolean {
  if (!isValidElement(node)) return false;
  const props = node.props as Record<string, unknown>;
  if (pred(props, node.type)) return true;
  return [props.children].flat().some((c) => find(c as ReactNode, pred));
}

beforeEach(() => {
  getUser.mockReset();
  getProfile.mockReset();
});

describe("/no-access page", () => {
  test("signed out redirects to /login", async () => {
    getUser.mockResolvedValue(null);
    await expect(NoAccessPage()).rejects.toThrow("redirect:/login");
  });
  test("profile redirects to role home", async () => {
    getUser.mockResolvedValue({ id: "u" });
    getProfile.mockResolvedValue({ role: "admin", workspaceId: "w" });
    await expect(NoAccessPage()).rejects.toThrow("redirect:/app/dashboard");
    getProfile.mockResolvedValue({ role: "delivery_agent", workspaceId: "w" });
    await expect(NoAccessPage()).rejects.toThrow("redirect:/app/my-day");
  });
  test("null renders reason, retry, sign-out, no workspace query", async () => {
    getUser.mockResolvedValue({ id: "u", email: "a@b.dz" });
    getProfile.mockResolvedValue(null);
    const tree = await NoAccessPage();
    expect(find(tree, (_, t) => t === "h1")).toBe(true);
    expect(find(tree, (p) => p.href === "/")).toBe(true);
    expect(find(tree, (_, t) => t === SignOutButton)).toBe(true);
    expect(find(tree, (_, t) => t === LocaleSwitcher)).toBe(true);
    expect(find(tree, (p, t) => t === "bdi" && p.children === "a@b.dz")).toBe(true);
  });
  test("unknown role renders without redirect", async () => {
    getUser.mockResolvedValue({ id: "u" });
    getProfile.mockResolvedValue({ role: "mystery_role", workspaceId: "w" });
    const tree = await NoAccessPage();
    expect(find(tree, (_, t) => t === "h1")).toBe(true);
  });
});
