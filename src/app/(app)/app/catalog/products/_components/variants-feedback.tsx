"use client";

import { useTranslations } from "next-intl";

import type { VariantResult } from "../actions";

/** Save outcome (role=alert on failure) or the unsaved hint; presentational so it renders without interaction. */
export function VariantsFeedback({ unsaved, result }: { unsaved: boolean; result: VariantResult | null }) {
  const t = useTranslations("variants");
  const message = result
    ? result.ok
      ? t("saved")
      : result.code === "duplicate_value"
        ? t("duplicateValue")
        : result.code === "duplicate_variant"
          ? t("duplicateVariant")
          : result.code === "in_use"
            ? t("inUse")
            : result.code === "stale"
              ? t("stale")
              : result.code === "invalid"
                ? t("invalid")
                : t("failed")
    : null;
  return (
    <>
      {unsaved && !message ? <p className="text-xs text-muted-foreground">{t("unsavedHint")}</p> : null}
      {message ? (
        <p role={result?.ok ? "status" : "alert"} className={result?.ok ? "text-sm text-success" : "rounded-md bg-danger-bg px-3 py-2 text-sm text-danger"}>
          {message}
        </p>
      ) : null}
    </>
  );
}
