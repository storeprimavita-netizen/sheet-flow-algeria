import { beforeEach, describe, expect, test, vi } from "vitest";

// minimal hook harness: no DOM in this suite, so drive the component function directly
let failed = false;
const setFailed = vi.fn((v: boolean) => void (failed = v));
const ref = { current: null as { complete: boolean; naturalWidth: number } | null };
let effect: (() => void) | undefined;
vi.mock("react", () => ({
  useRef: () => ref,
  useState: () => [failed, setFailed],
  useEffect: (fn: () => void) => void (effect = fn),
}));

import { StorePhoto } from "./photo";

type El = { type: string; props: Record<string, unknown> };

describe("StorePhoto", () => {
  beforeEach(() => {
    failed = false;
    setFailed.mockClear();
    ref.current = null;
  });

  test("StorePhoto shows placeholder on error", () => {
    const img = StorePhoto({ src: "/x.jpg", alt: "a", className: "store-photo", emptyLabel: "no photo" }) as unknown as El;
    expect(img.type).toBe("img");
    expect(img.props.className).toBe("store-photo");
    (img.props.onError as () => void)();
    expect(setFailed).toHaveBeenCalledWith(true);
    const ph = StorePhoto({ src: "/x.jpg", alt: "a", emptyLabel: "no photo" }) as unknown as El;
    expect(ph.type).toBe("div");
    expect(ph.props.className).toBe("store-photo-empty");
    expect(ph.props.children).toBe("no photo");
  });

  test("an image that failed before hydration is caught in the effect", () => {
    StorePhoto({ src: "/x.jpg", alt: "" });
    ref.current = { complete: true, naturalWidth: 0 };
    effect!();
    expect(setFailed).toHaveBeenCalledWith(true);
    setFailed.mockClear();
    ref.current = { complete: true, naturalWidth: 800 };
    effect!();
    expect(setFailed).not.toHaveBeenCalled();
  });

  test("decorative placeholder is hidden from assistive tech", () => {
    failed = true;
    const ph = StorePhoto({ src: "/x.jpg", alt: "" }) as unknown as El;
    expect(ph.props["aria-hidden"]).toBe(true);
  });
});
