import { isValidElement, type ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const getProfile = vi.fn();
vi.mock("@/lib/rbac", () => ({ getProfile: () => getProfile() }));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (k: string) => `t:${k}` }));

import AppNotFound, { generateMetadata } from "./not-found";

function find(node: ReactNode, pred: (props: Record<string, unknown>, type: unknown) => boolean): Record<string, unknown> | null {
  if (!isValidElement(node)) return null;
  const props = node.props as Record<string, unknown>;
  if (pred(props, node.type)) return props;
  for (const c of [props.children].flat()) {
    const hit = find(c as ReactNode, pred);
    if (hit) return hit;
  }
  return null;
}

describe("app not-found", () => {
  beforeEach(() => getProfile.mockReset());
  test("shows title and role-based href", async () => {
    expect(await generateMetadata()).toEqual({ title: "t:title" });
    for (const [role, href] of [["admin", "/app/dashboard"], ["confirmation_agent", "/app/orders"], ["delivery_agent", "/app/orders"]] as const) {
      getProfile.mockResolvedValue({ role, workspaceId: "w" });
      const tree = await AppNotFound();
      expect(find(tree, (p) => typeof p.href === "string")?.href).toBe(href);
      expect(find(tree, (p, type) => type === "h1" && p.children === "t:title")).not.toBeNull();
    }
  });
  test("no profile falls back to the orders home", async () => {
    getProfile.mockResolvedValue(null);
    expect(find(await AppNotFound(), (p) => typeof p.href === "string")?.href).toBe("/app/orders");
  });
});
