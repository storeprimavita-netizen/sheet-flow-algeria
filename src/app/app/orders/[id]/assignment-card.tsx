"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { UserCog } from "lucide-react";

import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/field";
import { assignAgents } from "../actions";

type Agent = { id: string; email: string };

const NONE = "__none"; // Radix Select needs a non-empty sentinel for "unassigned"

export function AssignmentCard({
  orderId,
  confirmationAgent,
  deliveryAgent,
  confirmationAgents,
}: {
  orderId: string;
  confirmationAgent: string | null;
  deliveryAgent: string | null;
  confirmationAgents: Agent[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const [conf, setConf] = useState(confirmationAgent ?? NONE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-saves on change, like tags/reason — no separate Save button.
  async function save(nextConf: string) {
    setConf(nextConf);
    setBusy(true);
    setError(null);
    const res = await assignAgents({
      orderId,
      confirmationAgent: nextConf === NONE ? null : nextConf,
      deliveryAgent, // D9: delivery agents are no longer assignable here; keep any legacy value
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="card-surface space-y-4 rounded-xl p-5" aria-busy={busy}>
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <UserCog className="h-4 w-4" />
        {t("workbench.assignment")}
      </h2>

      <div className="grid grid-cols-1 gap-4">
        <Field label={t("workbench.assignConfirmation")}>
          <Select value={conf} onValueChange={(v) => save(v)} disabled={busy}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t("workbench.unassigned")}</SelectItem>
              {confirmationAgents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {error ? (
        <p className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>
      ) : null}
    </div>
  );
}
