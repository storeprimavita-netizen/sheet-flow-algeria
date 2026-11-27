import { describe, expect, test } from "vitest";

import { fetchAll, lastPage, pageHref, pageRange, parsePage, readPage } from "@/lib/list-pagination";

const all = Array.from({ length: 2345 }, (_, i) => i);
const slice = async (from: number, to: number) => ({ data: all.slice(from, to + 1), error: null, count: all.length });

describe("list pagination", () => {
  test("parsePage falls back to 1 for missing, zero, negative, decimal and text values", () => {
    for (const bad of [undefined, null, "", "0", "-2", "1.5", "abc", "1e3", ["2"]]) expect(parsePage(bad)).toBe(1);
    expect(parsePage("7")).toBe(7);
  });

  test("pageRange and lastPage cover empty, exact-multiple and remainder counts", () => {
    expect(pageRange(1)).toEqual([0, 24]);
    expect(pageRange(3)).toEqual([50, 74]);
    expect([0, 25, 50, 51].map(lastPage)).toEqual([1, 1, 2, 3]);
  });

  test("fetchAll returns every row past 1000 and throws when a later batch fails", async () => {
    expect(await fetchAll(slice)).toEqual(all);
    await expect(
      fetchAll(async (from, to) => (from ? { data: null, error: { message: "boom" } } : slice(from, to))),
    ).rejects.toThrow("boom");
  });

  test("readPage sends a page past the end to the last page and throws on other errors", async () => {
    const past = async (from: number, to: number) =>
      from >= all.length ? { data: null, error: { message: "range", code: "PGRST103" } } : slice(from, to);
    expect(await readPage(999, past)).toEqual({ rows: [], total: all.length, goTo: 94 });
    expect((await readPage(94, past)).rows).toHaveLength(20);
    await expect(readPage(1, async () => ({ data: null, error: { message: "denied" } }))).rejects.toThrow("denied");
  });

  test("pageHref replaces one pager and keeps the other params", () => {
    expect(pageHref("/a", { x: "1", depositsPage: "9", y: undefined }, "depositsPage", 2)).toBe("/a?x=1&depositsPage=2");
  });
});
