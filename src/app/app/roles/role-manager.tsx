"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { KeyRound, UserPlus, Mail } from "lucide-react";

import type { Enums } from "@/lib/supabase/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/field";
import { Empty } from "@/components/empty";
import { setRole, inviteUser, sendResetEmail } from "./actions";

const ROLES: Enums<"app_role">[] = ["admin", "confirmation_agent", "delivery_agent"];

export type UserRow = {
  id: string;
  email: string | null;
  role: Enums<"app_role"> | null;
};

export function RoleManager({ users }: { users: UserRow[] }) {
  const t = useTranslations();
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Enums<"app_role">>("confirmation_agent");
  const [inviting, setInviting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveRole(e: React.FormEvent<HTMLFormElement>, userId: string) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const role = String(fd.get("role")) as Enums<"app_role">;
    setBusyId(userId);
    setError(null);
    const res = await setRole(userId, role);
    setBusyId(null);
    if (!res.ok) setError(res.error);
    else router.refresh();
  }

  async function invite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setInviting(true);
    setError(null);
    setMsg(null);
    const res = await inviteUser(inviteEmail, inviteRole);
    setInviting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setInviteEmail("");
    setMsg(t("roles.invited"));
    router.refresh();
  }

  async function reset(email: string) {
    setError(null);
    setMsg(null);
    const res = await sendResetEmail(email);
    if (!res.ok) setError(res.error);
    else setMsg(t("roles.resetSent"));
  }

  return (
    <div className="space-y-6">
      {/* invite */}
      <form onSubmit={invite} className="glass-card space-y-4 rounded-xl p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <UserPlus className="h-4 w-4" />
          {t("roles.invite")}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <Field label={t("roles.email")} htmlFor="invite_email">
            <Input
              id="invite_email"
              type="email"
              required
              placeholder="name@mnw.xxx"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
          </Field>
          <Field label={t("roles.role")} htmlFor="invite_role">
            <Select
              id="invite_role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as Enums<"app_role">)}
              className="w-auto"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`role.${r}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" disabled={inviting}>
            {inviting ? t("actions.saving") : t("roles.invite")}
          </Button>
        </div>
      </form>

      {msg ? <p className="rounded-md bg-emerald-500/15 px-3 py-2 text-sm text-emerald-700">{msg}</p> : null}
      {error ? <p className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">{error}</p> : null}

      {/* roster */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <KeyRound className="h-4 w-4" />
          {t("roles.roster")}
        </h2>
        {!users.length ? (
          <Empty>{t("roles.none")}</Empty>
        ) : (
          <div className="glass-card overflow-hidden rounded-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="p-3 text-start">{t("roles.email")}</th>
                    <th className="p-3 text-start">{t("roles.role")}</th>
                    <th className="p-3 text-start">{t("roles.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-border/50">
                      <td className="p-3">
                        <span className="flex items-center gap-1.5 font-medium">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          {u.email ?? u.id.slice(0, 8)}
                        </span>
                      </td>
                      <td className="p-3 align-middle">
                        <form onSubmit={(e) => saveRole(e, u.id)} className="flex items-center gap-2">
                          <Select name="role" defaultValue={u.role ?? "confirmation_agent"} className="w-auto">
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {t(`role.${r}`)}
                              </option>
                            ))}
                          </Select>
                          <Button type="submit" size="sm" disabled={busyId === u.id}>
                            {busyId === u.id ? t("actions.saving") : t("actions.save")}
                          </Button>
                        </form>
                      </td>
                      <td className="p-3 align-middle">
                        {u.email ? (
                          <Button type="button" variant="secondary" size="sm" onClick={() => reset(u.email!)}>
                            {t("roles.reset")}
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
