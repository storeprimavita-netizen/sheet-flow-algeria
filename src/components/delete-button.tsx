"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

type DeletableTable = "products" | "contacts" | "orders" | "expenses" | "seasons" | "season_periods";

export function DeleteButton({
  table,
  id,
  redirectTo,
  className,
  label,
  confirmText,
  variant = "destructive",
  action,
}: {
  table?: DeletableTable;
  id: string;
  redirectTo: string;
  className?: string;
  /** accessible name that tells identical buttons apart */
  label?: string;
  confirmText?: string;
  variant?: "destructive" | "outline" | "ghost";
  /** server action that deletes the row (used instead of the browser client, e.g. to refresh a public cache) */
  action?: (id: string) => Promise<{ ok: boolean }>;
}) {
  const router = useRouter();
  const t = useTranslations();
  const [busy, setBusy] = useState(false);

  async function del() {
    if (!window.confirm(confirmText ?? t("common.deleteConfirm"))) return;
    setBusy(true);
    if (action) {
      const r = await action(id);
      setBusy(false);
      if (!r.ok) {
        window.alert(t("common.deleteFailed"));
        return;
      }
      router.push(redirectTo);
      router.refresh();
      return;
    }
    const supabase = createClient();
    if (!table) {
      setBusy(false);
      return;
    }
    const { error } = await supabase.from(table).delete().eq("id", id);
    setBusy(false);
    if (error) {
      window.alert(error.code === "23503" ? t("common.deleteInUse") : error.message);
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      className={className}
      aria-label={label}
      onClick={del}
      disabled={busy}
    >
      <Trash2 />
      {t("actions.delete")}
    </Button>
  );
}
