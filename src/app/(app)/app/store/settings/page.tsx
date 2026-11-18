import { getTranslations } from "next-intl/server";

import { ButtonLink } from "@/components/button-link";
import { Empty } from "@/components/empty";
import { PageHeader } from "@/components/page-header";
import { publicSettingsSchema } from "@/lib/store/settings";

import { Crumbs } from "../_components/crumbs";
import { SettingsForm } from "../_components/settings-form";
import { getStore } from "../_lib/data";

export default async function StoreSettingsPage() {
  const t = await getTranslations("store.admin");
  const store = await getStore();
  const parsed = store ? publicSettingsSchema.safeParse(store.settings) : null;
  return (
    <div className="space-y-6">
      <div>
        <Crumbs items={[{ label: t("settings.title") }]} />
        <PageHeader title={t("settings.title")} subtitle={t("settings.purpose")} />
      </div>
      {!store ? (
        <Empty>
          <p className="mb-3">{t("settings.noStore")}</p>
          <ButtonLink href="/app/store">{t("settings.goHub")}</ButtonLink>
        </Empty>
      ) : (
        <SettingsForm store={{ id: store.id, name: store.name, slug: store.slug, status: store.status, settings: parsed?.success ? parsed.data : {} }} />
      )}
    </div>
  );
}
