"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import type { OptionRow } from "@/lib/option-sets";
import { Field } from "@/components/field";
import { OptionSelect, OptionMultiSelect } from "@/components/fields/option-select";
import { setOrderTags, setOrderCancellationReason } from "../actions";

/** Order tags (multi) + cancellation reason — both option_sets, both auto-save on change. */
export function OrderTaxonomyCard({
  orderId,
  tags,
  selectedTagIds,
  reasons,
  cancellationReasonId,
  showReason,
  locked = false,
}: {
  orderId: string;
  tags: OptionRow[];
  selectedTagIds: string[];
  reasons: OptionRow[];
  cancellationReasonId: string | null;
  /** only meaningful on a cancelled order */
  showReason: boolean;
  /** non-admin on a shipped order: cancel reason is read-only/hidden */
  locked?: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();

  return (
    <div className="card-surface grid grid-cols-1 gap-4 rounded-xl p-5 sm:grid-cols-2">
      <Field label={t("fields.tags")}>
        <OptionMultiSelect
          setKey="order_tag"
          value={selectedTagIds}
          options={tags.map((o) => ({ value: o.id, label: o.label, token: o.color_token, archived: !!o.archived_at }))}
          placeholder={t("fields.tags")}
          onChange={async (ids) => {
            const res = await setOrderTags(orderId, ids);
            if (!res.ok) toast.error(res.error);
            else router.refresh();
          }}
        />
      </Field>
      {showReason && !locked ? (
        <Field label={t("fields.cancellationReason")} hint={t("common.optional")}>
          <OptionSelect
            setKey="cancellation_reason"
            value={cancellationReasonId ?? undefined}
            options={reasons.map((o) => ({ value: o.id, label: o.label, token: o.color_token, archived: !!o.archived_at }))}
            placeholder={t("fields.cancellationReason")}
            onChange={async (id) => {
              const res = await setOrderCancellationReason(orderId, id || null);
              if (!res.ok) toast.error(res.error);
              else router.refresh();
            }}
          />
        </Field>
      ) : null}
    </div>
  );
}
