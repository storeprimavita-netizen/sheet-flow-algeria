"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { Tables } from "@/lib/supabase/database.types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/field";
import { WilayaCombobox } from "@/components/fields/comboboxes";
import { saveCustomer } from "./actions";

type CustomerRow = Tables<"customers">;

/** Customer profile edit form — admin-editable name/wilaya/commune/notes. */
export function CustomerForm({
  customer,
  wilayas,
}: {
  customer: CustomerRow;
  wilayas: { code: number; name: string }[];
}) {
  const t = useTranslations();
  const [wilayaCode, setWilayaCode] = React.useState(customer.wilaya_code ? String(customer.wilaya_code) : "");
  const wilayaOpts = wilayas.map((w) => ({ code: String(w.code), name: w.name }));

  return (
    <form
      action={saveCustomer.bind(null, customer.id)}
      className="card-surface grid grid-cols-1 gap-4 rounded-xl p-5 sm:grid-cols-2"
    >
      <Field label={t("fields.name")} htmlFor="name">
        <Input id="name" name="name" required defaultValue={customer.name} />
      </Field>
      <Field label={t("fields.wilaya")}>
        <WilayaCombobox
          wilayas={wilayaOpts}
          value={wilayaCode}
          onChange={setWilayaCode}
          name="wilaya_code"
          placeholder={t("fields.none")}
        />
      </Field>
      <Field label={t("fields.city")} htmlFor="commune" hint={t("common.optional")}>
        <Input id="commune" name="commune" defaultValue={customer.commune ?? ""} />
      </Field>
      <Field label={t("fields.notes")} htmlFor="notes" hint={t("common.optional")}>
        <Textarea id="notes" name="notes" defaultValue={customer.notes ?? ""} />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit">{t("actions.save")}</Button>
      </div>
    </form>
  );
}
