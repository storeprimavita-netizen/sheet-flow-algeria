import Link from "next/link";

import { cn } from "@/lib/utils";

export type RelatedLink = { href: string; label: string };

export function PageHeader({
  title,
  subtitle,
  related,
  children,
  className,
}: {
  title: React.ReactNode;
  subtitle: React.ReactNode;
  /** Up to three sibling pages worth jumping to. */
  related?: readonly [RelatedLink] | readonly [RelatedLink, RelatedLink] | readonly [RelatedLink, RelatedLink, RelatedLink];
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div>
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">{title}</h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
        {related?.length ? (
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {related.map((r) => (
              <Link key={r.href} href={r.href} className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                {r.label}
              </Link>
            ))}
          </p>
        ) : null}
      </div>
      {children ? <div className="flex items-center gap-2">{children}</div> : null}
    </div>
  );
}
