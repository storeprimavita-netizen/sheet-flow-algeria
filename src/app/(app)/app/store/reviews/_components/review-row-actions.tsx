"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { SettingSwitch } from "@/components/fields/setting-switch";
import { Button } from "@/components/ui/button";

import { deleteReview, setReviewApproved } from "../../actions";

/** Approve switch (named after the reviewer) and delete. Both go through server actions so the public cache is refreshed. */
export function ReviewRowActions({ id, name, approved }: { id: string; name: string; approved: boolean }) {
  const t = useTranslations("store.admin.reviews");
  const tc = useTranslations("store.admin.editor");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [on, setOn] = useState(approved);

  function toggle(next: boolean) {
    setOn(next);
    start(async () => {
      const r = await setReviewApproved(id, next);
      if (r.ok) {
        toast.success(next ? t("nowApproved") : t("nowHidden"));
        router.refresh();
      } else {
        setOn(!next);
        toast.error(tc("errFailed"));
      }
    });
  }

  function remove() {
    if (!window.confirm(t("deleteConfirm"))) return;
    start(async () => {
      const r = await deleteReview(id);
      if (r.ok) {
        toast.success(t("deleted"));
        router.refresh();
      } else toast.error(tc("errFailed"));
    });
  }

  return (
    <div className="flex items-center justify-end gap-3">
      <SettingSwitch label={t("approveLabel", { name })} checked={on} onCheckedChange={toggle} disabled={pending} />
      <Button type="button" variant="destructive" size="sm" aria-label={t("deleteLabel", { name })} onClick={remove} disabled={pending}>
        <Trash2 />
        {t("delete")}
      </Button>
    </div>
  );
}
