import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { navLeaves, purposeKey, visibleNav } from "@/components/nav-model";
import { Empty } from "@/components/empty";
import { getCurrentUserRole } from "@/lib/rbac";

/** Landing page of a nav group: the leaves this role may open, each with its purpose. */
export async function GroupHub({ groupKey }: { groupKey: string }) {
  const role = await getCurrentUserRole();
  const group = visibleNav(role).groups.find((g) => g.key === groupKey);
  if (!group) {
    const first = navLeaves(role)[0];
    if (first) redirect(first.href);
    notFound();
  }
  if (group.items.length === 1) redirect(group.items[0].href);

  const t = await getTranslations();
  return (
    <div className="space-y-6">
      <PageHeader title={t(`nav.${group.key}`)} subtitle={t(`navPurpose.${group.key}`)} />
      {group.items.length === 0 ? (
        <Empty>{t("nav.hubEmpty")}</Empty>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {group.items.map((leaf) => (
            <li key={leaf.key}>
              <Link
                href={leaf.href}
                className="flex h-full items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-ring"
              >
                <leaf.icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block font-medium text-foreground">{t(`nav.${leaf.key}`)}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{t(purposeKey(leaf))}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
