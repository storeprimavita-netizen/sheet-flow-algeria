"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Selling tab error state: reason + retry. */
export default function SellingError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const t = useTranslations();
  useEffect(() => console.error(error), [error]);

  return (
    <div className="card-surface mx-auto max-w-md space-y-4 rounded-xl p-6 text-center" role="alert">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-danger-bg text-danger">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-semibold">{t("store.admin.selling.errorTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("errorPage.body")}</p>
      </div>
      <Button type="button" onClick={() => unstable_retry()}>
        <RotateCw className="h-4 w-4" />
        {t("errorPage.retry")}
      </Button>
      {error.digest ? (
        <p className="num text-xs text-faint">
          {t("errorPage.ref")}: {error.digest}
        </p>
      ) : null}
    </div>
  );
}
