"use client";

import { useState } from "react";

import { StorePhoto } from "./photo";
import { st } from "./t";

/** Product photos in a scroll-snap row. A broken file drops its slot; one placeholder shows only when every file is broken. */
export function Gallery({ name, images }: { name: string; images: string[] }) {
  const [failed, setFailed] = useState<ReadonlySet<number>>(new Set());
  const allFailed = images.length === 0 || failed.size >= images.length;
  return (
    <div className="store-gallery" role="group" aria-label={name}>
      {allFailed ? (
        <div className="store-photo-empty">{st("noPhoto")}</div>
      ) : (
        images.map((src, i) =>
          failed.has(i) ? null : (
            <StorePhoto
              key={src}
              className="store-photo"
              src={src}
              // the number stays the original position even when earlier slides were dropped
              alt={st("galleryAlt", { n: i + 1, total: images.length })}
              title={name}
              width={800}
              height={1000}
              {...(i === 0 ? { fetchPriority: "high" as const } : { loading: "lazy" as const })}
              decoding={i === 0 ? "sync" : "async"}
              onFail={() => setFailed((prev) => new Set(prev).add(i))}
            />
          ),
        )
      )}
    </div>
  );
}
