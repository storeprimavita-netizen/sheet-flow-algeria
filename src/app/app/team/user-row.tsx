"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import type { Role } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { RoleSelect } from "@/components/fields/role-select";
import { updateUser } from "./actions";

type Profile = { user_id: string; display_name: string | null; duty: string | null; role: Role; is_active: boolean };

export function UserRow({ profile, email }: { profile: Profile; email: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const res = await updateUser(profile.user_id, {
      role: String(fd.get("role")) as Role,
      duty: String(fd.get("duty") ?? ""),
      is_active: fd.get("is_active") === "on",
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <tr className="align-top">
      <td className="font-medium">{profile.display_name ?? "—"}</td>
      <td className="text-muted-foreground">{email || "—"}</td>
      <td colSpan={4}>
        <form onSubmit={onSubmit} className="flex flex-wrap items-start gap-2">
          <Input name="duty" defaultValue={profile.duty ?? ""} className="w-36" />
          <div className="w-48">
            <RoleSelect name="role" defaultValue={profile.role} />
          </div>
          <label className="flex items-center gap-2 pt-2.5 text-xs">
            <Switch name="is_active" defaultChecked={profile.is_active} />
            {t("team.active")}
          </label>
          <Button type="submit" size="sm" className="mt-0.5" disabled={busy}>
            {busy ? t("actions.saving") : t("actions.save")}
          </Button>
          {error ? <p className="w-full text-xs text-destructive">{error}</p> : null}
        </form>
      </td>
    </tr>
  );
}
