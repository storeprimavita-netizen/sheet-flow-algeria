import { isValidElement, type ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const state = { busy: false, failed: false };
vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>();
  let call = 0;
  return {
    ...actual,
    useState: () => {
      const key = call++ % 2 === 0 ? "busy" : "failed";
      return [state[key], (v: boolean) => void (state[key] = v)];
    },
  };
});
const replace = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));
vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => `t:${k}` }));
const signOut = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { signOut } }) }));

import { SignOutButton } from "./sign-out-button";

function find(node: ReactNode, pred: (p: Record<string, unknown>) => boolean): Record<string, unknown> | null {
  if (!isValidElement(node)) return null;
  const props = node.props as Record<string, unknown>;
  if (pred(props)) return props;
  for (const c of [props.children].flat()) {
    const hit = find(c as ReactNode, pred);
    if (hit) return hit;
  }
  return null;
}

describe("SignOutButton", () => {
  beforeEach(() => {
    signOut.mockReset();
    replace.mockReset();
    refresh.mockReset();
    state.busy = false;
    state.failed = false;
  });

  test("failure shows alert, no navigation", async () => {
    signOut.mockResolvedValue({ error: new Error("x") });
    const click = find(SignOutButton({}), (p) => typeof p.onClick === "function")!.onClick as () => Promise<void>;
    await click();
    expect(replace).not.toHaveBeenCalled();
    expect(state.failed).toBe(true);
    expect(state.busy).toBe(false);
    const el = SignOutButton({});
    expect(find(el, (p) => p.role === "alert")).not.toBeNull();
  });

  test("success navigates to /login", async () => {
    signOut.mockResolvedValue({ error: null });
    const click = find(SignOutButton({}), (p) => typeof p.onClick === "function")!.onClick as () => Promise<void>;
    await click();
    expect(replace).toHaveBeenCalledWith("/login");
  });

  test("busy disables", () => {
    state.busy = true;
    const tree = SignOutButton({});
    const btn = find(tree, (p) => typeof p.onClick === "function")!;
    expect(btn["aria-busy"]).toBe(true);
    expect(btn.disabled).toBe(true);
  });
});
