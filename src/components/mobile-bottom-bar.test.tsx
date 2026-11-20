import { createRef, isValidElement, type ReactNode } from "react";
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
  test("active on sub-route", () => {
    path = "/app/sell/confirmation/123";
    const links = collect(MobileBottomBar({ role: "confirmation_agent", counts, onMore: () => {} })).filter((e) => typeof e.props.href === "string");
    path = "/app/sell/confirmation";
    expect(links.map((l) => l.props["aria-current"])).toEqual([undefined, "page"]);
  });
  test("99+ cap", () => {
    const els = collect(MobileBottomBar({ role: "confirmation_agent", counts: { ...counts, confirmation: 99 }, onMore: () => {} }));
    expect(els.some((e) => e.props.children === 99)).toBe(true);
    expect(els.some((e) => e.props.children === "99+")).toBe(false);
    const over = collect(MobileBottomBar({ role: "confirmation_agent", counts: { ...counts, confirmation: 100 }, onMore: () => {} }));
    expect(over.some((e) => e.props.children === "99+")).toBe(true);
  });
  test("has md:hidden", () => {
    const nav = collect(MobileBottomBar({ role: "admin", counts, onMore: () => {} })).find((e) => e.type === "nav")!;
    expect(String(nav.props.className).split(" ")).toContain("md:hidden");
  });
  test("focus returns to More on drawer close: the More button carries the shell's ref", () => {
    // The shell's effect focuses toggleRef on close; this pins that the ref lands on the More button.
    const moreRef = createRef<HTMLButtonElement>();
    const more = collect(MobileBottomBar({ role: "admin", counts, onMore: () => {}, moreRef })).find((e) => e.type === "button")!;
    expect(more.props.ref).toBe(moreRef);
  });
});
