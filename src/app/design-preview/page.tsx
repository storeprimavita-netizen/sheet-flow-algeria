import { notFound } from "next/navigation";

import { DesignPreview } from "./design-preview";

/** Dev-only design mirror (DESIGN_SYSTEM.md §8). Hidden in production. */
export default function DesignPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DesignPreview />;
}
