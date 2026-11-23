import type { CSSProperties } from "react";

import type { PublicSwatch } from "@/lib/store/data";

/** A decorative preview beside the colour's visible label. */
export function Swatch({ swatch }: { swatch: PublicSwatch | null }) {
  if (swatch?.image) {
    // eslint-disable-next-line @next/next/no-img-element -- validated HTTPS swatch, never a CSS URL
    return <img className="store-dot" src={swatch.image} alt="" width={32} height={32} loading="lazy" />;
  }
  return swatch?.color
    ? <span className="store-dot" aria-hidden="true" style={{ "--swatch": swatch.color } as CSSProperties} />
    : null;
}
