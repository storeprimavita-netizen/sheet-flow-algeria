import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { clearSearchHref } from "./_lib/kanban";
import { CLEARED } from "@/lib/order-views";

const read = (rel: string) => readFileSync(join(__dirname, rel), "utf8");

describe("clearSearchHref", () => {
  test("clearSearchHref drops q and page and keeps view, show and layout", () => {
    const href = clearSearchHref("/app/sell/confirmation", { view: "v1", show: "all", layout: "kanban", q: "Amina", page: "3" }, undefined);
    expect(href).toBe("/app/sell/confirmation?view=v1&show=all&layout=kanban");
    expect(clearSearchHref("/p", { q: "x" }, undefined)).toBe("/p");
  });

  test("clearSearchHref marks a view's own q cleared", () => {
    const href = clearSearchHref("/p", { view: "v1", q: "Amina" }, { q: "Karim" });
    expect(new URLSearchParams(href.split("?")[1]).get("q")).toBe(CLEARED);
  });
});

describe("queue pages pass the search", () => {
  test("confirmation and shipping pass the search to table and board", () => {
    for (const [file, table] of [["../confirmation/page.tsx", "ConfirmationTable"], ["../shipping/page.tsx", "DeliveryTable"]]) {
      const src = read(file);
      expect(src).toMatch(/const search = cfg\.q \? \{ q: cfg\.q, clearHref: clearSearchHref\(/);
      expect(src).toMatch(new RegExp(`<${table} [^>]*search=\\{search\\}`));
      expect(src).toMatch(/<OrderBoardEmpty [^>]*search=\{search\}/);
    }
  });

  test("no search passes nothing", () => {
    expect(read("(list)/page.tsx")).not.toMatch(/<OrderBoardEmpty[^>]*search=/);
    expect(read("../confirmation/page.tsx")).toMatch(/cfg\.q \? \{[^}]*\} : undefined/);
  });
});
