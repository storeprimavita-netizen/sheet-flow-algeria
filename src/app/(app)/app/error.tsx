"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";

/** One error state for every /app section: reason + retry (cod-ui-polish §4 states). */
export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const t = useTranslations("errorPage");
  useEffect(() => console.error(error), [error]);

  return (
    <div className="card-surface mx-auto mt-12 max-w-md space-y-4 rounded-xl p-6 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-danger-bg text-danger">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("body")}</p>
      </div>
      <Button type="button" onClick={() => unstable_retry()}>
        <RotateCw className="h-4 w-4" />
        {t("retry")}
      </Button>
      {error.digest ? (
        <p className="num text-xs text-faint">
          {t("ref")}: {error.digest}
        </p>
      ) : null}
    </div>
  );
}
