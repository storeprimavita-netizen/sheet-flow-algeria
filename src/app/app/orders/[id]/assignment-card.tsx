"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { UserCog } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/field";
import { assignAgents } from "@/app/app/workbench/actions";

type Agent = { id: string; email: string };

export function AssignmentCard({
  orderId,
  confirmationAgent,
  deliveryAgent,
  confirmationAgents,
  deliveryAgents,
}: {
  orderId: string;
  confirmationAgent: string | null;
  deliveryAgent: string | null;
  confirmationAgents: Agent[];
  deliveryAgents: Agent[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const res = await assignAgents({
      orderId,
      confirmationAgent: (String(fd.get("confirmation_agent") ?? "") || null) as string | null,
      deliveryAgent: (String(fd.get("delivery_agent") ?? "") || null) as string | null,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="glass-card space-y-4 rounded-xl p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <UserCog className="h-4 w-4" />
        {t("workbench.assignment")}
      </h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("workbench.assignConfirmation")} htmlFor="confirmation_agent">
          <Select id="confirmation_agent" name="confirmation_agent" defaultValue={confirmationAgent ?? ""}>
            <option value="">{t("workbench.unassigned")}</option>
            {confirmationAgents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.email}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("workbench.assignDelivery")} htmlFor="delivery_agent">
          <Select id="delivery_agent" name="delivery_agent" defaultValue={deliveryAgent ?? ""}>
            <option value="">{t("workbench.unassigned")}</option>
            {deliveryAgents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.email}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {error ? (
        <p className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">{error}</p>
      ) : null}

      <Button type="submit" disabled={busy}>
        {busy ? t("actions.saving") : t("actions.save")}
      </Button>
    </form>
  );
}
