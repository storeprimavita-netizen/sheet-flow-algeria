"use client";

import * as React from "react";
import { Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** App-styled frame around the store preview: says it is a preview and lets the admin check phone width. */
export function PreviewFrame({ children }: { children: React.ReactNode }) {
  const t = useTranslations("store.admin.selling.preview");
  const [narrow, setNarrow] = React.useState(false);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-raised px-3 py-2">
        <p className="text-sm">
          <span className="font-medium text-warning">{t("label")}</span>
          <span className="ms-2 text-muted-foreground">{t("note")}</span>
        </p>
        <Button type="button" size="sm" variant="outline" aria-pressed={narrow} onClick={() => setNarrow((n) => !n)}>
          <Smartphone />
          {narrow ? t("wide") : t("narrow")}
        </Button>
      </div>
      <div className={cn("mx-auto w-full", narrow && "max-w-[390px]")}>{children}</div>
    </div>
  );
}
