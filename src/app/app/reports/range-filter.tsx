"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/field";

export function RangeFilter({ from, to }: { from: string; to: string }) {
  const t = useTranslations();
  const router = useRouter();
  const params = useSearchParams();
  const [f, setF] = useState(from);
  const [tt, setTt] = useState(to);

  function apply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next = new URLSearchParams(params?.toString() ?? "");
    next.set("from", f);
    next.set("to", tt);
    router.push(`/app/reports?${next.toString()}`);
  }

  return (
    <form onSubmit={apply} className="glass-card flex flex-wrap items-end gap-3 rounded-xl p-4">
      <span className="flex items-center gap-2 text-sm font-medium">
        <CalendarDays className="h-4 w-4" />
        {t("reports.range")}
      </span>
      <Field label={t("reports.from")} htmlFor="from">
        <Input id="from" type="date" value={f} onChange={(e) => setF(e.target.value)} className="w-44" />
      </Field>
      <Field label={t("reports.to")} htmlFor="to">
        <Input id="to" type="date" value={tt} onChange={(e) => setTt(e.target.value)} className="w-44" />
      </Field>
      <Button type="submit">{t("reports.apply")}</Button>
    </form>
  );
}
