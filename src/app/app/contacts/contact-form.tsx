import { getTranslations } from "next-intl/server";

import type { Tables } from "@/lib/supabase/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/field";
import { SupplierTypeSelect } from "@/components/fields/supplier-type-select";
import { PhoneField } from "@/components/fields/phone-field";
import { saveContact } from "./actions";

type ContactRow = Tables<"contacts">;

export async function ContactForm({ contact }: { contact?: ContactRow }) {
  const t = await getTranslations();

  return (
    <form action={saveContact.bind(null, contact?.id ?? null)} className="space-y-6">
      <div className="card-surface space-y-4 rounded-xl p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("fields.name")} htmlFor="name">
            <Input id="name" name="name" required defaultValue={contact?.name ?? ""} />
          </Field>
          <Field label={t("fields.type")}>
            <SupplierTypeSelect name="type" defaultValue={contact?.type ?? "other"} />
          </Field>
          <Field label={t("fields.phone")} htmlFor="phone" hint={t("common.optional")}>
            <PhoneField id="phone" name="phone" defaultValue={contact?.phones?.[0] ?? ""} />
          </Field>
          <Field label={t("fields.location")} htmlFor="location" hint={t("common.optional")}>
            <Input id="location" name="location" defaultValue={contact?.location ?? ""} />
          </Field>
        </div>
        <Field label={t("fields.notes")} htmlFor="notes" hint={t("common.optional")}>
          <Textarea id="notes" name="notes" defaultValue={contact?.notes ?? ""} />
        </Field>
      </div>

      <Button type="submit">{t("actions.save")}</Button>
    </form>
  );
}
