"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

type DeletableTable = "products" | "contacts" | "orders" | "expenses";

export function DeleteButton({
  table,
  id,
  redirectTo,
  className,
}: {
  table: DeletableTable;
  id: string;
  redirectTo: string;
  className?: string;
}) {
  const router = useRouter();
  const t = useTranslations();
  const [busy, setBusy] = useState(false);

  async function del() {
    if (!window.confirm(t("common.deleteConfirm"))) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from(table).delete().eq("id", id);
    setBusy(false);
    if (error) {
      window.alert(error.message);
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      className={className}
      onClick={del}
      disabled={busy}
    >
      <Trash2 />
      {t("actions.delete")}
    </Button>
  );
}
