"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

type DeletableTable = "products" | "contacts" | "orders" | "expenses" | "seasons" | "season_periods";

type Common = {
  id: string;
  className?: string;
  /** accessible name that tells identical buttons apart */
  label?: string;
  confirmText?: string;
  variant?: "destructive" | "outline" | "ghost";
};
type DeleteButtonProps =
  | (Common & { table: DeletableTable; redirectTo: string; action?: never })
  /** server action that deletes the row (e.g. to refresh a public cache); the page is refreshed in place, so filters survive */
  | (Common & { action: (id: string) => Promise<{ ok: boolean }>; table?: never; redirectTo?: never });

type Outcome = { ok: true } | { ok: false; message: string };

/** The delete call itself, kept free of React so it can be tested: a failure returns the message to show and never navigates. */
export async function runDelete(
  props: Pick<DeleteButtonProps, "table" | "action" | "id">,
  messages: { failed: string; inUse: string },
): Promise<Outcome> {
  if (props.action) {
    const r = await props.action(props.id);
    return r.ok ? { ok: true } : { ok: false, message: messages.failed };
  }
  const { error } = await createClient().from(props.table!).delete().eq("id", props.id);
  if (error) return { ok: false, message: error.code === "23503" ? messages.inUse : error.message };
  return { ok: true };
}

export function DeleteButton(props: DeleteButtonProps) {
  const { id, className, label, confirmText, variant = "destructive" } = props;
  const router = useRouter();
  const t = useTranslations();
  const [busy, setBusy] = useState(false);

  async function del() {
    if (!window.confirm(confirmText ?? t("common.deleteConfirm"))) return;
    setBusy(true);
    const r = await runDelete(props, { failed: t("common.deleteFailed"), inUse: t("common.deleteInUse") });
    setBusy(false);
    if (!r.ok) {
      window.alert(r.message);
      return;
    }
    if (props.redirectTo) router.push(props.redirectTo);
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
