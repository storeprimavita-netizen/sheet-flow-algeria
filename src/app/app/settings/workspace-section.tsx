import { getTranslations } from "next-intl/server";

import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { renameWorkspace } from "./actions";

export async function WorkspaceSection({ name }: { name: string }) {
  const t = await getTranslations();

  return (
    <section id="workspace" className="card-surface scroll-mt-20 space-y-4 rounded-xl p-5">
      <h2 className="text-sm font-semibold">{t("settings.workspace")}</h2>
      <form action={renameWorkspace} className="flex flex-wrap items-end gap-3">
        <Field label={t("fields.name")} htmlFor="ws-name" className="min-w-64">
          <Input id="ws-name" name="name" required defaultValue={name} />
        </Field>
        <Button type="submit">{t("actions.save")}</Button>
      </form>
    </section>
  );
}
