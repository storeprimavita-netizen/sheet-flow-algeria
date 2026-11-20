"use client";

import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "onError"> & {
  /** Text inside the placeholder; omit for a purely decorative one. */
  emptyLabel?: string;
  /** Called once when the file is known to be broken (lets a gallery drop the slot). */
  onFail?: () => void;
};

/** True when the browser already gave up on the file (the error event can fire before hydration). */
export function imageFailed(el: { complete: boolean; naturalWidth: number } | null): boolean {
  return !!el && el.complete && el.naturalWidth === 0;
}

/**
 * Plain `<img>` that falls back to the `store-photo-empty` placeholder when the file fails to load,
 * including a failure that happened before hydration (the error event is already gone by then).
 */
export function StorePhoto({ emptyLabel, onFail, className, ...img }: Props) {
  const ref = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);
  const fail = () => {
    setFailed(true);
    onFail?.();
  };
  useEffect(() => {
    // a lazy image that has not started loading can look "complete with no pixels": only onError counts for it
    if (img.loading !== "lazy" && imageFailed(ref.current)) fail();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only check
  }, []);
  if (failed) {
    return (
      <div className="store-photo-empty" role={emptyLabel ? "img" : undefined} aria-label={emptyLabel} aria-hidden={emptyLabel ? undefined : true}>
        {emptyLabel}
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- plain img by design (no remote image optimizer)
  return <img ref={ref} className={className} {...img} onError={fail} />;
}
