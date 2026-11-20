"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Save } from "lucide-react";
import { toast } from "sonner";

import { EnumSelect } from "@/components/fields/enum-select";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStatusLabel } from "@/components/status-labels-provider";

import { saveStoreSettings } from "../actions";

type Props = {
  store: { id: string; name: string; slug: string; status: string; settings: Record<string, string | undefined> };
};

export function SettingsForm({ store }: Props) {
  const t = useTranslations("store.admin");
  const ts = useTranslations("status.store_status");
  const statusLabel = useStatusLabel();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState(store.status);
  const [slug, setSlug] = useState(store.slug);

  function submit(f: FormData) {
    const g = (k: string) => String(f.get(k) ?? "");
    start(async () => {
      const r = await saveStoreSettings({
        id: store.id,
        name: g("name"),
        slug: g("slug"),
        status,
        settings: {
          phone: g("phone"),
          whatsapp: g("whatsapp"),
          instagram: g("instagram"),
          announcement: g("announcement"),
          slogan: g("slogan"),
        },
      });
      if (r.ok) {
        setError(null);
        toast.success(t("settings.saved"));
        router.refresh();
      } else {
        setError(r.error === "slug_taken" ? t("hub.slugTaken") : r.error === "invalid" ? t("hub.invalid") : t("hub.failed"));
      }
    });
  }

  const s = store.settings;
  return (
    <form action={submit} className="space-y-6">
      <section className="card-surface space-y-4 rounded-xl p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label={t("settings.name")} htmlFor="s-name">
            <Input id="s-name" name="name" required maxLength={80} defaultValue={store.name} />
          </Field>
          <Field label={t("settings.slug")} htmlFor="s-slug" hint={slug !== store.slug ? t("settings.slugWarn") : t("hub.slugHint")}>
            <Input id="s-slug" name="slug" required dir="ltr" pattern="[a-z0-9\-]{2,40}" minLength={2} maxLength={40} autoCapitalize="none" spellCheck={false} defaultValue={store.slug} onChange={(e) => setSlug(e.target.value)} />
          </Field>
          <Field label={t("settings.status")} htmlFor="s-status">
            <EnumSelect
              id="s-status"
              value={status}
              onChange={setStatus}
              options={[
                { value: "draft", label: statusLabel("store", "draft", ts("draft")) },
                { value: "live", label: statusLabel("store", "live", ts("live")) },
              ]}
            />
          </Field>
        </div>
      </section>

      <section className="card-surface space-y-4 rounded-xl p-5">
        <div>
          <h2 className="text-base font-semibold">{t("settings.contact")}</h2>
          <p className="text-sm text-muted-foreground">{t("settings.publicNote")}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label={t("settings.phone")} htmlFor="s-phone">
            <Input id="s-phone" name="phone" type="tel" dir="ltr" maxLength={20} defaultValue={s.phone ?? ""} />
          </Field>
          <Field label={t("settings.whatsapp")} htmlFor="s-wa" hint={t("settings.whatsappHint")}>
            <Input id="s-wa" name="whatsapp" inputMode="numeric" dir="ltr" pattern="[0-9]{8,15}" maxLength={15} defaultValue={s.whatsapp ?? ""} />
          </Field>
          <Field label={t("settings.instagram")} htmlFor="s-ig" hint={t("settings.instagramHint")}>
            <Input id="s-ig" name="instagram" dir="ltr" pattern="[A-Za-z0-9._]{1,30}" maxLength={30} autoCapitalize="none" defaultValue={s.instagram ?? ""} />
          </Field>
          <Field label={t("settings.announcement")} htmlFor="s-ann" className="md:col-span-2">
            <Input id="s-ann" name="announcement" maxLength={160} defaultValue={s.announcement ?? ""} />
          </Field>
          <Field label={t("settings.slogan")} htmlFor="s-slogan">
            <Input id="s-slogan" name="slogan" maxLength={120} defaultValue={s.slogan ?? ""} />
          </Field>
        </div>
      </section>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        <Save className="h-4 w-4" />
        {t("settings.save")}
      </Button>
    </form>
  );
}
