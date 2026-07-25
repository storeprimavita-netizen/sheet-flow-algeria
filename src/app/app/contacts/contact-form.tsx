"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { createClient } from "@/lib/supabase/client";
import type { Enums, Tables, TablesInsert } from "@/lib/supabase/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/field";
import { CONTACT_TYPES } from "@/lib/enums";

type ContactRow = Tables<"contacts">;

export function ContactForm({ contact }: { contact?: ContactRow }) {
  const router = useRouter();
  const t = useTranslations();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editing = Boolean(contact?.id);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const opt = (n: string) => String(fd.get(n) ?? "").trim() || null;
    const payload: TablesInsert<"contacts"> = {
      name: String(fd.get("name") ?? "").trim(),
      type: String(fd.get("type") ?? "customer") as Enums<"contact_type">,
      phone: opt("phone"),
      city: opt("city"),
      location: opt("location"),
      email: opt("email"),
      notes: opt("notes"),
    };

    const supabase = createClient();
    const { error } = editing
      ? await supabase.from("contacts").update(payload).eq("id", contact!.id)
      : await supabase.from("contacts").insert(payload);

    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/app/contacts");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="glass-card space-y-4 rounded-xl p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("fields.name")} htmlFor="name">
            <Input id="name" name="name" required defaultValue={contact?.name ?? ""} />
          </Field>
          <Field label={t("fields.type")} htmlFor="type">
            <Select id="type" name="type" defaultValue={contact?.type ?? "customer"}>
              {CONTACT_TYPES.map((s) => (
                <option key={s} value={s}>
                  {t(`status.contact_type.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("fields.phone")} htmlFor="phone" hint={t("common.optional")}>
            <Input id="phone" name="phone" defaultValue={contact?.phone ?? ""} />
          </Field>
          <Field label={t("fields.email")} htmlFor="email" hint={t("common.optional")}>
            <Input id="email" name="email" type="email" defaultValue={contact?.email ?? ""} />
          </Field>
          <Field label={t("fields.city")} htmlFor="city" hint={t("common.optional")}>
            <Input id="city" name="city" defaultValue={contact?.city ?? ""} />
          </Field>
          <Field label={t("fields.location")} htmlFor="location" hint={t("common.optional")}>
            <Input id="location" name="location" defaultValue={contact?.location ?? ""} />
          </Field>
        </div>
        <Field label={t("fields.notes")} htmlFor="notes" hint={t("common.optional")}>
          <Textarea id="notes" name="notes" defaultValue={contact?.notes ?? ""} />
        </Field>
      </div>

      {error ? (
        <p className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">{error}</p>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? t("actions.saving") : t("actions.save")}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={busy}>
          {t("actions.cancel")}
        </Button>
      </div>
    </form>
  );
}
