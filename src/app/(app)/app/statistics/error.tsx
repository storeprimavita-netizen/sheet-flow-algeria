"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Statistics error state: reason + retry. */
export default function StatisticsError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const t = useTranslations("statistics");
  useEffect(() => console.error(error), [error]);
  return (
    <div role="alert" className="card-surface mx-auto mt-12 max-w-md space-y-4 rounded-xl p-6 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-danger-bg text-danger">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <p className="text-sm text-muted-foreground">{t("loadError")}</p>
      <Button type="button" onClick={() => unstable_retry()}>
        <RotateCw className="h-4 w-4" />
        {t("retry")}
      </Button>
    </div>
  );
}
