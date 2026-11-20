"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

export function StatusLabelsError({ title, reason }: { title: string; reason: string }) {
  const t = useTranslations();
  const router = useRouter();
  return (
    <section className="card-surface space-y-2 rounded-xl p-5" role="alert">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="text-sm text-danger">{t("settings.statusLabels.loadError", { reason })}</p>
      <Button type="button" size="sm" variant="outline" onClick={() => router.refresh()}>
        {t("table.retry")}
      </Button>
    </section>
  );
}
