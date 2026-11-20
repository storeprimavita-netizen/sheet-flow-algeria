"use client";

import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "onError"> & {
  /** Text inside the placeholder; omit for a purely decorative one. */
  emptyLabel?: string;
};

/** True when the browser already gave up on the file (the error event can fire before hydration). */
export function imageFailed(el: { complete: boolean; naturalWidth: number } | null): boolean {
  return !!el && el.complete && el.naturalWidth === 0;
}

/**
 * Plain `<img>` that falls back to the `store-photo-empty` placeholder when the file fails to load,
 * including a failure that happened before hydration (the error event is already gone by then).
 */
export function StorePhoto({ emptyLabel, className, ...img }: Props) {
  const ref = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (imageFailed(ref.current)) setFailed(true);
  }, []);
  if (failed) {
    return (
      <div className="store-photo-empty" role={emptyLabel ? "img" : undefined} aria-label={emptyLabel} aria-hidden={emptyLabel ? undefined : true}>
        {emptyLabel}
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- plain img by design (no remote image optimizer)
  return <img ref={ref} className={className} {...img} onError={() => setFailed(true)} />;
}
