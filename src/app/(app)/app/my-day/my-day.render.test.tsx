import { isValidElement, type ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";

vi.mock("next-intl/server", () => ({ getTranslations: async () => (k: string) => `t:${k}` }));
vi.mock("@/lib/rbac", () => ({}));
vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => `t:${k}` }));
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), useEffect: () => {} }));

import { MyDayView } from "./my-day-view";
import MyDayLoading from "./loading";
import AppError from "../error";
import type { MyDayData } from "@/lib/my-day";

function walk(node: ReactNode, visit: (props: Record<string, unknown>, type: unknown) => void) {
  if (Array.isArray(node)) return node.forEach((n) => walk(n, visit));
  if (!isValidElement(node)) return;
  const props = node.props as Record<string, unknown>;
  visit(props, node.type);
  walk(props.children as ReactNode, visit);
}
const texts = (tree: ReactNode) => {
  const out: string[] = [];
  walk(tree, (p) => typeof p.children === "string" && out.push(p.children));
  return out;
};
const hrefs = (tree: ReactNode) => {
  const out: string[] = [];
  walk(tree, (p) => typeof p.href === "string" && out.push(p.href));
  return out;
};

const base = { tasks: [], nextMeeting: null };
const conf: MyDayData = { ...base, kind: "confirmation", queue: 3, numbers: { confirmed: 1, cancelled: 0, callAgain: 2, handled: 3 } };

describe("my-day render", () => {
  test("renders four states, no links to tasks/meetings, no money", async () => {
    // empty
    const empty = await MyDayView({ data: conf });
    expect(texts(empty)).toEqual(expect.arrayContaining(["t:tasksEmpty", "t:meetingEmpty"]));
    // populated
    const full = await MyDayView({
      data: { ...conf, tasks: [{ id: "1", title: "Call back", dueDate: "2026-01-02", status: "todo" }], nextMeeting: { id: "m", title: "Weekly", scheduledAt: "2026-01-03T10:00:00Z" } },
    });
    expect(texts(full)).toEqual(expect.arrayContaining(["Call back", "Weekly"]));
    for (const tree of [empty, full]) {
      expect(hrefs(tree)).toEqual(["/app/sell/confirmation"]); // only the queue: nothing to /team/*
      expect(JSON.stringify(tree)).not.toMatch(/DZD|cost|profit|price|amount/i);
    }
    // delivery variant: queue to shipping
    const del = await MyDayView({ data: { ...base, kind: "delivery", queue: 0, numbers: { delivered: 0, returned: 0 } } });
    expect(hrefs(del)).toEqual(["/app/sell/shipping"]);
    const labels: string[] = [];
    walk(del, (p) => typeof p.label === "string" && labels.push(p.label));
    expect(labels).toEqual(["t:stat.delivered", "t:stat.returned"]);
  });

  test("loading state", () => {
    const tree = MyDayLoading();
    expect(JSON.stringify(tree)).toContain('"aria-busy":"true"');
    expect(JSON.stringify(tree)).toContain("animate-pulse");
  });

  test("error state shows retry", () => {
    const retry = vi.fn();
    const tree = AppError({ error: new Error("boom"), unstable_retry: retry });
    const buttons: Record<string, unknown>[] = [];
    walk(tree, (p, type) => type !== undefined && typeof p.onClick === "function" && buttons.push(p));
    expect(buttons).toHaveLength(1);
    (buttons[0].onClick as () => void)();
    expect(retry).toHaveBeenCalledOnce();
    expect(JSON.stringify(tree)).toContain("t:retry");
  });
});
