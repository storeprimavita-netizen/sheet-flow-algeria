import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldOff } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { ButtonLink } from "@/components/button-link";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { SignOutButton } from "@/components/sign-out-button";
import { getProfile, getUser } from "@/lib/rbac";
import { roleHome } from "@/lib/role-home";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("noAccess");
  return { title: t("title") };
}

/**
 * Landing for a signed-in user with no usable profile (no row, inactive, no
 * workspace). Lives outside /app so no shell, guard or workspace query runs.
 */
export default async function NoAccessPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const profile = await getProfile();
  if (profile) {
    const home = roleHome(profile.role);
    if (home !== "/no-access") redirect(home);
  }

  const t = await getTranslations("noAccess");
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card-surface w-full max-w-md rounded-2xl p-8">
        <div className="mb-6 flex items-center justify-end">
          <LocaleSwitcher className="min-h-11" />
        </div>

        <div className="mb-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-warning-bg text-warning">
            <ShieldOff className="h-6 w-6" aria-hidden />
          </div>
          <h1 className="mt-2 text-2xl font-bold text-foreground">{t("title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("body")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("hint")}</p>
          {user.email && (
            <p className="mt-4 text-sm text-muted-foreground">
              {t("account")} <bdi dir="ltr" className="font-medium text-foreground">{user.email}</bdi>
            </p>
          )}
        </div>

        <div className="space-y-3">
          <ButtonLink href="/" className="w-full min-h-11">
            {t("retry")}
          </ButtonLink>
          <SignOutButton size="lg" />
        </div>
      </div>
    </main>
  );
}
