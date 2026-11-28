import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  path: "/a",
  set: vi.fn(),
  effects: [] as { fn: () => unknown; deps: unknown[] }[],
}));
vi.mock("next/navigation", () => ({ usePathname: () => hooks.path }));
vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));
vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>();
  return {
    ...actual,
    useContext: () => hooks.set,
    useEffect: (fn: () => unknown, deps: unknown[]) => {
      hooks.effects.push({ fn, deps });
    },
  };
});

import { CrumbList, CrumbRecord } from "./breadcrumbs";

const lis = (html: string) => html.match(/<li[^>]*>/g) ?? [];

describe("breadcrumbs", () => {
  test("no bdi inside a dir=auto crumb", () => {
    const html = renderToStaticMarkup(
      <CrumbList crumbs={[{ label: "الطلبات", href: "/x" }, { label: "طلب جديد" }]} hasTail={false} />,
    );
    expect(html).not.toContain("<bdi");
    expect(html).toContain('title="الطلبات"');
    expect(html).toContain('title="طلب جديد"');
    expect(html.match(/dir="auto"/g)).toHaveLength(2);
  });

  test("tail keeps its width after a record", () => {
    const crumbs = [{ label: "A", href: "/a" }, { label: "Rec", href: "/r" }, { label: "Preview" }];
    const tail = lis(renderToStaticMarkup(<CrumbList crumbs={crumbs} hasTail />));
    const last = tail[tail.length - 1];
    expect(last).toContain("shrink-0");
    expect(last).not.toContain("min-w-[40%]");
    expect(tail[tail.length - 2]).not.toContain("shrink-0");
    const plain = lis(renderToStaticMarkup(<CrumbList crumbs={crumbs} hasTail={false} />));
    expect(plain[plain.length - 1]).toContain("min-w-[40%]");
  });

  test("record re-registers on a path change under a persistent layout", () => {
    hooks.effects.length = 0;
    hooks.path = "/a";
    CrumbRecord({ label: "Rec" });
    hooks.path = "/b";
    CrumbRecord({ label: "Rec" });
    const [first, second] = hooks.effects;
    expect(first.deps).not.toEqual(second.deps);
    second.fn();
    expect(hooks.set).toHaveBeenCalledWith({ label: "Rec", href: undefined, tail: undefined });
  });
});
