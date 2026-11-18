import { FileQuestion } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { ButtonLink } from "@/components/button-link";
import { Empty } from "@/components/empty";

/** Inside the app shell: a missing or forbidden page gets words and a way back, in the user's language. */
export default async function AppNotFound() {
  const t = await getTranslations("notFoundPage");
  return (
    <Empty className="mx-auto max-w-md space-y-4">
      <FileQuestion className="mx-auto h-8 w-8 text-faint" aria-hidden />
      <div className="space-y-1">
        <h1 className="text-base font-semibold text-foreground">{t("title")}</h1>
        <p>{t("body")}</p>
      </div>
      <ButtonLink href="/app/dashboard">{t("back")}</ButtonLink>
    </Empty>
  );
}
