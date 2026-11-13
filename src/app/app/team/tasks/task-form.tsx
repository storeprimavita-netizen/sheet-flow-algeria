"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import type { Tables } from "@/lib/supabase/database.types";
import { TASK_STATUSES } from "@/lib/enums";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/fields/date-field";
import { EnumSelect } from "@/components/fields/enum-select";
import { PrioritySelect } from "@/components/fields/priority-select";
import { ProductCombobox } from "@/components/fields/comboboxes";
import { StatusPill } from "@/components/status-pill";
import { saveTask } from "./actions";

type TaskRow = Tables<"tasks">;

/** The one task create/edit form — used by both the kanban card sheet and the
 * list-view sheet (interconnection: one component, two surfaces). Status here
 * is a plain enum select (all 4 values, no transition restriction) since this
 * is a direct edit, not a workflow-advance control like the kanban/table's
 * own <StatusSelect> quick-change. */
export function TaskForm({
  task,
  owners,
  meetings,
  products,
  onDone,
}: {
  task?: TaskRow;
  owners: { user_id: string; display_name: string | null }[];
  meetings: { id: string; title: string; scheduled_at: string }[];
  products: { id: string; name: string; image?: string | null; status?: string | null }[];
  onDone?: () => void;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  // Controlled (not just seeded via defaultValue): Combobox's `value` prop
  // always wins over its own internal selection state, so a static prop
  // derived from `task` would permanently pin the field (same bug the
  // customer-detail wilaya combobox hit in Phase 12 §6) — must round-trip
  // through onChange to stay editable.
  const [productId, setProductId] = React.useState(task?.product_id ?? "");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const res = await saveTask(new FormData(e.currentTarget));
    setBusy(false);
    if (res.ok) {
      toast.success(t("common.updated"));
      router.refresh();
      onDone?.();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="id" value={task?.id ?? ""} />

      <Field label={t("fields.title")}>
        <Input name="title" defaultValue={task?.title ?? ""} required autoFocus />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("fields.agent")} hint={t("common.optional")}>
          <EnumSelect
            name="owner"
            defaultValue={task?.owner ?? "__none"}
            options={[
              { value: "__none", label: t("fields.none") },
              ...owners.map((o) => ({ value: o.user_id, label: o.display_name ?? o.user_id })),
            ]}
          />
        </Field>
        <Field label={t("fields.due_date")} hint={t("common.optional")}>
          <DateField name="due_date" defaultValue={task?.due_date ?? ""} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("fields.priority")}>
          <PrioritySelect name="priority" defaultValue={task?.priority ?? "medium"} />
        </Field>
        <Field label={t("fields.status")}>
          <EnumSelect
            name="status"
            defaultValue={task?.status ?? "todo"}
            options={TASK_STATUSES.map((s) => ({
              value: s,
              label: <StatusPill kind="task" status={s} size="sm" />,
            }))}
          />
        </Field>
      </div>

      <Field label={t("team.meeting")} hint={t("common.optional")}>
        <EnumSelect
          name="meeting_id"
          defaultValue={task?.meeting_id ?? "__none"}
          options={[
            { value: "__none", label: t("fields.none") },
            ...meetings.map((m) => ({ value: m.id, label: m.title })),
          ]}
        />
      </Field>

      <Field label={t("fields.product")} hint={t("common.optional")}>
        <ProductCombobox
          name="product_id"
          products={products}
          value={productId}
          onChange={setProductId}
          placeholder={t("fields.product")}
        />
      </Field>

      <div className="flex justify-end gap-2">
        {onDone ? (
          <Button type="button" variant="ghost" size="sm" onClick={onDone}>
            {t("actions.cancel")}
          </Button>
        ) : null}
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? t("actions.saving") : task ? t("actions.save") : t("actions.create")}
        </Button>
      </div>
    </form>
  );
}
