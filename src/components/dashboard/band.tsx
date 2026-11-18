import { AlertCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { cn } from "@/lib/utils";
import { RetryButton } from "./band-retry";

/** One dashboard band: a titled section. Children render the populated / empty state. */
export function Band({
  title,
  id,
  note,
  className,
  children,
}: {
  title: string;
  id: string;
  /** muted line after the title, e.g. "not filtered" */
  note?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("flex h-full flex-col gap-2", className)} aria-labelledby={id}>
      <h2 id={id} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
        {note ? <span className="ms-2 font-normal normal-case tracking-normal text-faint">· {note}</span> : null}
      </h2>
      {children}
    </section>
  );
}

/** Error state: the reason and a retry button (router.refresh re-runs the server queries). */
export async function BandError() {
  const t = await getTranslations("dashboard.v2");
  return (
    <div role="alert" className="card-surface flex flex-wrap items-center gap-3 rounded-xl p-4 text-sm">
      <AlertCircle className="h-4 w-4 shrink-0 text-danger" />
      <span className="min-w-0 flex-1 text-muted-foreground">{t("loadError")}</span>
      <RetryButton label={t("retry")} />
    </div>
  );
}
