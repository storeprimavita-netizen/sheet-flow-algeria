import type { Metadata } from "next";

import { st } from "@/components/store/t";

export const metadata: Metadata = { title: st("notFound.title"), robots: { index: false, follow: false } };

export default function StoreNotFound() {
  return (
    <main className="store-wrap store-message" id="main">
      <h1>{st("notFound.title")}</h1>
      <p>{st("notFound.body")}</p>
    </main>
  );
}
