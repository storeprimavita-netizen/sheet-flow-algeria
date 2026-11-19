"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { DeleteButton } from "@/components/delete-button";

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

  return (
    <div className="flex items-center justify-end gap-3">
      <Switch aria-label={t("approveLabel", { name })} checked={on} onCheckedChange={toggle} disabled={pending} />
      <DeleteButton
        id={id}
        action={deleteReview}
        redirectTo="/app/store/reviews"
        label={t("deleteLabel", { name })}
        confirmText={t("deleteConfirm")}
      />
    </div>
  );
}
