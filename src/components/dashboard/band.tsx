import Link from "next/link";
import { AlertCircle, RefreshCw } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { cn } from "@/lib/utils";

/** One dashboard band: a titled section. Children render the populated / empty state. */
export function Band({
  title,
  id,
  className,
  children,
}: {
  title: string;
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("space-y-2", className)} aria-labelledby={id}>
      <h2 id={id} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Error state: the reason and a retry link back to this very page (re-runs the server queries). */
export async function BandError({ retryHref }: { retryHref: string }) {
  const t = await getTranslations("dashboard.v2");
  return (
    <div role="alert" className="card-surface flex flex-wrap items-center gap-3 rounded-xl p-4 text-sm">
      <AlertCircle className="h-4 w-4 shrink-0 text-danger" />
      <span className="min-w-0 flex-1 text-muted-foreground">{t("loadError")}</span>
      <Link href={retryHref} className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline">
        <RefreshCw className="h-3.5 w-3.5" />
        {t("retry")}
      </Link>
    </div>
  );
}
