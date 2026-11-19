import type { Metadata } from "next";
import { FileQuestion } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { ButtonLink } from "@/components/button-link";
import { Empty } from "@/components/empty";
import { getProfile } from "@/lib/rbac";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notFoundPage");
  return { title: t("title") };
}

/** Inside the app shell: a missing or forbidden page gets words and a way back, in the user's language. */
export default async function AppNotFound() {
  const t = await getTranslations("notFoundPage");
  const profile = await getProfile();
  const home = profile?.role === "admin" ? "/app/dashboard" : "/app/orders";
  return (
    <Empty className="mx-auto max-w-md space-y-4">
      <FileQuestion className="mx-auto h-8 w-8 text-faint" aria-hidden />
      <div className="space-y-1">
        <h1 className="text-base font-semibold text-foreground">{t("title")}</h1>
        <p>{t("body")}</p>
      </div>
      <ButtonLink href={home}>{t("back")}</ButtonLink>
    </Empty>
  );
}
