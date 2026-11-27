import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createSearchSync, leavesAddress } from "./search-param-sync";

const CLEARED = "__cleared__";

function setup(opts: { qs?: string; inherited?: string; text?: string } = {}) {
  const writes: string[] = [];
  const texts: string[] = [];
  const s = createSearchSync({ write: (q) => writes.push(q), onText: (t) => texts.push(t), param: "q", clearedMarker: CLEARED, initialText: opts.text ?? "" });
  s.seen(opts.qs ?? "view=a", opts.inherited ?? "");
  return { s, writes, texts };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("search param sync", () => {
  test("a: typing writes once after 300ms, trimmed, without page", () => {
    const { s, writes } = setup({ qs: "view=a&page=3" });
    s.type("Amina ");
    vi.advanceTimersByTime(299);
    expect(writes).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(writes).toEqual(["view=a&q=Amina"]);
  });

  test("b: trailing space stays in the box when its own write comes back", () => {
    const { s, writes, texts } = setup();
    s.type("Amina ");
    vi.advanceTimersByTime(300);
    s.seen(writes[0], "");
    expect(texts).toEqual([]);
  });

  test("c: view switch before 300ms writes nothing and shows the new view's search", () => {
    const { s, writes, texts } = setup();
    s.type("Amina");
    vi.advanceTimersByTime(100);
    s.seen("view=b", "");
    vi.advanceTimersByTime(1000);
    expect(writes).toEqual([]);
    expect(texts).toEqual([""]);
    const k = setup();
    k.s.type("Amina");
    k.s.seen("view=b", "Karim");
    vi.advanceTimersByTime(1000);
    expect(k.writes).toEqual([]);
    expect(k.texts).toEqual(["Karim"]);
  });

  test("d: Reset before 300ms writes nothing and shows the view's search", () => {
    const { s, writes, texts } = setup({ qs: "view=a&delivery_status=x", inherited: "Karim", text: "Karim" });
    s.type("Zed");
    s.seen("view=a", "Karim");
    vi.advanceTimersByTime(1000);
    expect(writes).toEqual([]);
    expect(texts).toEqual(["Karim"]);
  });

  test("e: emptied box then Reset never writes the cleared marker", () => {
    const { s, writes, texts } = setup({ qs: "view=a&status=x", inherited: "Karim", text: "Karim" });
    s.type("");
    s.seen("view=a", "Karim");
    vi.advanceTimersByTime(1000);
    expect(writes).toEqual([]);
    expect(texts).toEqual(["Karim"]);
  });

  test("emptied box over an inherited value writes the cleared marker", () => {
    const { s, writes } = setup({ qs: "view=a", inherited: "Karim", text: "Karim" });
    s.type("");
    vi.advanceTimersByTime(300);
    expect(writes).toEqual([`view=a&q=${CLEARED}`]);
  });

  test("f: slow echo does not snap the box back", () => {
    const { s, writes, texts } = setup();
    s.type("Ami");
    vi.advanceTimersByTime(300);
    s.type("Amina");
    s.seen(writes[0], "");
    expect(texts).toEqual([]);
    vi.advanceTimersByTime(300);
    expect(writes).toEqual(["view=a&q=Ami", "view=a&q=Amina"]);
  });

  test("g: older echo arriving after a newer write was sent", () => {
    const { s, writes, texts } = setup();
    s.type("Ami");
    vi.advanceTimersByTime(300);
    s.type("Amina");
    vi.advanceTimersByTime(300);
    s.seen(writes[0], "");
    s.seen(writes[1], "");
    expect(texts).toEqual([]);
    vi.advanceTimersByTime(1000);
    expect(writes).toHaveLength(2);
  });

  test("h: status picked before 300ms carries search and status, no page, nothing sent after", () => {
    const { s, writes, texts } = setup({ qs: "view=a&page=2" });
    s.type("Amina");
    const params = new URLSearchParams("view=a&page=2");
    params.set("status", "x");
    s.mergeInto(params);
    expect(params.get("q")).toBe("Amina");
    expect(params.get("status")).toBe("x");
    expect(params.has("page")).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(writes).toEqual([]);
    s.seen(params.toString(), "");
    expect(texts).toEqual([]);
  });

  test("a same-view layout switch carries pending search text", () => {
    const { s, writes } = setup({ qs: "view=a&page=2&confirmation_status=no_answer" });
    s.type("Amina");
    const params = new URLSearchParams("view=a&page=2&confirmation_status=no_answer");
    params.set("layout", "kanban");
    s.mergeInto(params);
    expect(Object.fromEntries(params)).toEqual({
      view: "a", confirmation_status: "no_answer", layout: "kanban", q: "Amina",
    });
    vi.advanceTimersByTime(1000);
    expect(writes).toEqual([]);
  });

  test("i: status picked while the search write is loading still carries the search", () => {
    const { s, writes } = setup();
    s.type("Amina");
    vi.advanceTimersByTime(300);
    expect(writes).toHaveLength(1);
    const params = new URLSearchParams("view=a"); // built from the old address
    params.set("status", "x");
    s.mergeInto(params);
    expect(params.get("q")).toBe("Amina");
  });

  test("j: cancel stops the waiting write and the object still works", () => {
    const { s, writes } = setup();
    s.type("Amina");
    s.cancel();
    s.cancel();
    vi.advanceTimersByTime(1000);
    expect(writes).toEqual([]);
    s.type("Bob");
    vi.advanceTimersByTime(300);
    expect(writes).toEqual(["view=a&q=Bob"]);
  });

  test("k: nothing is written when the text equals the shown value", () => {
    const { s, writes } = setup({ qs: "view=a&q=Amina", text: "Amina" });
    s.type("Amina ");
    vi.advanceTimersByTime(1000);
    expect(writes).toEqual([]);
    const i = setup({ qs: "view=a", inherited: "Karim", text: "Karim" });
    i.s.type("Karim");
    vi.advanceTimersByTime(1000);
    expect(i.writes).toEqual([]);
  });

  test("l: an outside change carrying a search fills the box and cancels the waiting write", () => {
    const { s, writes, texts } = setup();
    s.type("Zed");
    s.seen("view=b&q=Amina", "");
    vi.advanceTimersByTime(1000);
    expect(writes).toEqual([]);
    expect(texts).toEqual(["Amina"]);
  });

  test("status picked then more typing before the echo keeps the status", () => {
    const { s, writes } = setup();
    s.type("Amina");
    const params = new URLSearchParams("view=a");
    params.set("status", "x");
    s.mergeInto(params);
    s.type("Amina B");
    vi.advanceTimersByTime(300);
    expect(Object.fromEntries(new URLSearchParams(writes[0]))).toEqual({ view: "a", status: "x", q: "Amina B" });
  });

  test("m: link cancel then a slow outside address: nothing is written", () => {
    const { s, writes, texts } = setup();
    s.type("Amina");
    vi.advanceTimersByTime(100);
    s.cancel();
    vi.advanceTimersByTime(20000);
    expect(writes).toEqual([]);
    s.seen("view=b", "");
    expect(texts).toEqual([""]);
  });

  test("n: leavesAddress is true only for a plain click to another address", () => {
    const cur = "https://x.test/app/orders?view=a";
    const ev = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };
    const ln = { href: "/app/orders?view=b", target: "", download: false };
    expect(leavesAddress(ln, ev, cur)).toBe(true);
    expect(leavesAddress({ ...ln, target: "_self" }, ev, cur)).toBe(true);
    expect(leavesAddress(ln, { ...ev, metaKey: true }, cur)).toBe(false);
    expect(leavesAddress(ln, { ...ev, button: 1 }, cur)).toBe(false);
    expect(leavesAddress({ ...ln, target: "_blank" }, ev, cur)).toBe(false);
    expect(leavesAddress({ ...ln, download: true }, ev, cur)).toBe(false);
    expect(leavesAddress({ ...ln, href: "tel:+213555" }, ev, cur)).toBe(false);
    expect(leavesAddress({ ...ln, href: "https://other.test/app/orders?view=b" }, ev, cur)).toBe(false);
    expect(leavesAddress({ ...ln, href: "/app/orders?view=a" }, ev, cur)).toBe(false);
    expect(leavesAddress({ ...ln, href: "/app/orders?view=a#top" }, ev, cur)).toBe(false);
  });

  test("o: text() is the trimmed box text", () => {
    const { s } = setup();
    s.type("  Amina ");
    expect(s.text()).toBe("Amina");
  });

  test("an echo with reordered params is the box's own write", () => {
    const { s, writes, texts } = setup({ qs: "a=1&b=2" });
    s.type("Z");
    vi.advanceTimersByTime(300);
    const reordered = new URLSearchParams(writes[0]);
    reordered.sort();
    s.seen(reordered.toString(), "");
    expect(texts).toEqual([]);
  });

  test("same query, changed inherited, is an outside change", () => {
    const { s, texts } = setup({ qs: "view=a", inherited: "Karim", text: "Karim" });
    s.seen("view=a", "Omar");
    expect(texts).toEqual(["Omar"]);
  });
});
