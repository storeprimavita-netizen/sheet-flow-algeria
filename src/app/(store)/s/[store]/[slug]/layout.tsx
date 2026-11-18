import { notFound } from "next/navigation";

import { getPublicProductPage } from "@/lib/store/data";

// Resolved above loading.tsx so a missing page answers with a real 404 status, not a streamed 200.
// The data call is cached (120 s + tags), so the page below reads the same entry.
export default async function StoreSlugLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ store: string; slug: string }>;
}) {
  const { store, slug } = await params;
  if (!(await getPublicProductPage(store, slug))) notFound();
  return children;
}
