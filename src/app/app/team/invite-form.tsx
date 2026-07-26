"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { UserPlus } from "lucide-react";

import type { Role } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/field";
import { inviteUser } from "./actions";

const ROLES: Role[] = ["confirmation_agent", "delivery_agent", "admin"];

export function InviteForm() {
  const t = useTranslations();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const res = await inviteUser({
      email: String(fd.get("email") ?? ""),
      role: String(fd.get("role") ?? "confirmation_agent") as Role,
      duty: String(fd.get("duty") ?? ""),
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    formRef.current?.reset();
    router.refresh();
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="glass-card space-y-4 rounded-xl p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <UserPlus className="h-4 w-4" />
        {t("team.invite")}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label={t("fields.email")}>
          <Input name="email" type="email" required />
        </Field>
        <Field label={t("team.duty")} hint={t("common.optional")}>
          <Input name="duty" />
        </Field>
        <Field label={t("fields.type")}>
          <Select name="role" defaultValue="confirmation_agent">
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`role.${r}`)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {error ? <p className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={busy}>
        {busy ? t("actions.saving") : t("team.invite")}
      </Button>
    </form>
  );
}
