import { isValidElement, type ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";

let path = "/app/sell/confirmation";
vi.mock("next/navigation", () => ({ usePathname: () => path }));
vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => `t:${k}` }));

import { MobileBottomBar } from "./mobile-bottom-bar";

function collect(node: ReactNode, out: { type: unknown; props: Record<string, unknown> }[] = []) {
  if (Array.isArray(node)) node.forEach((n) => collect(n, out));
  else if (isValidElement(node)) {
    const props = node.props as Record<string, unknown>;
    out.push({ type: node.type, props });
    collect(props.children as ReactNode, out);
  }
  return out;
}
const counts = { confirmation: 120, delivery: 0, tasks: 0 };

describe("MobileBottomBar", () => {
  test("renders aria-current on active", () => {
    const els = collect(MobileBottomBar({ role: "confirmation_agent", counts, onMore: () => {} }));
    const links = els.filter((e) => typeof e.props.href === "string");
    expect(links.map((l) => [l.props.href, l.props["aria-current"]])).toEqual([
      ["/app/my-day", undefined],
      ["/app/sell/confirmation", "page"],
    ]);
    expect(els.some((e) => e.props.children === "99+")).toBe(true);
    const more = els.find((e) => e.type === "button")!;
    expect(more.props["aria-current"]).toBeUndefined();
  });
  test("More opens drawer", () => {
    const onMore = vi.fn();
    const more = collect(MobileBottomBar({ role: "admin", counts, onMore })).find((e) => e.type === "button")!;
    (more.props.onClick as () => void)();
    expect(onMore).toHaveBeenCalledOnce();
  });
});
