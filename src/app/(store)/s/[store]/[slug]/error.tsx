"use client";

import { st } from "@/components/store/t";

// Never shows error.message: it can carry internals.
export default function StoreError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="store-wrap store-message" role="alert">
      <h1>{st("error.title")}</h1>
      <p>{st("error.body")}</p>
      <button className="store-btn" type="button" onClick={reset}>{st("error.retry")}</button>
    </main>
  );
}
