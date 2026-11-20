import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), useEffect: () => {} }));
import AuditError from "./error";
import AuditLoading from "./loading";

/** Depth-first search of a React element tree (function components are not expanded). */
function find(node: ReactNode, pred: (e: ReactElement<{ onClick?: () => void; children?: ReactNode }>) => boolean): ReactElement<{ onClick?: () => void }> | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const n of node) { const r = find(n, pred); if (r) return r; }
    return null;
  }
  const el = node as ReactElement<{ onClick?: () => void; children?: ReactNode }>;
  if (pred(el)) return el;
  return find(el.props?.children, pred);
}

describe("audit states", () => {
  test("loading: busy skeleton", () => {
    const html = renderToStaticMarkup(<AuditLoading />);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("animate-pulse");
  });
  test("error: alert with reason and retry calls unstable_retry", () => {
    const retry = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const tree = AuditError({ error: new Error("x"), unstable_retry: retry });
    const html = renderToStaticMarkup(tree);
    expect(html).toContain('role="alert"');
    expect(html).toContain("audit.errorReason");
    const btn = find(tree, (e) => (e.props as { type?: string }).type === "button" && typeof e.props?.onClick === "function");
    expect(btn).not.toBeNull();
    btn!.props.onClick!();
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
