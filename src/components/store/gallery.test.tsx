import { beforeEach, describe, expect, test, vi } from "vitest";

// no DOM in this suite: drive the component with a stubbed useState
let failed = new Set<number>();
const setFailed = vi.fn();
vi.mock("react", () => ({ useState: () => [failed, setFailed] }));
vi.mock("./photo", () => ({ StorePhoto: () => null }));

import { Gallery } from "./gallery";

type El = { type: unknown; props: { className?: string; children?: unknown } };
const IMAGES = ["/a.jpg", "/b.jpg", "/c.jpg"];

function slots(images: string[]) {
  const root = Gallery({ name: "Abaya", images }) as unknown as El;
  return [root.props.children].flat().filter(Boolean) as El[];
}

describe("Gallery", () => {
  beforeEach(() => {
    failed = new Set();
    setFailed.mockClear();
  });

  test("none failed: every photo renders", () => {
    expect(slots(IMAGES)).toHaveLength(3);
  });

  test("some failed: failed slides are hidden and alt keeps the original position", () => {
    failed = new Set([1]);
    const s = slots(IMAGES) as unknown as { key: string; props: { alt: string } }[];
    expect(s.map((e) => e.key)).toEqual(["/a.jpg", "/c.jpg"]);
    expect(s[1].props.alt).toContain("3");
  });

  test("all failed (or no images): exactly one placeholder", () => {
    failed = new Set([0, 1, 2]);
    const s = slots(IMAGES);
    expect(s).toHaveLength(1);
    expect(s[0].props.className).toBe("store-photo-empty");
    expect(slots([])).toHaveLength(1);
  });

  test("onFail records the index", () => {
    const s = slots(IMAGES) as unknown as { props: { onFail: () => void } }[];
    s[2].props.onFail();
    const update = setFailed.mock.calls[0][0] as (p: Set<number>) => Set<number>;
    expect([...update(new Set([0]))]).toEqual([0, 2]);
  });
});
