import Link from "next/link";
import type { VariantProps } from "class-variance-authority";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** A Next `<Link>` styled exactly like a `<Button>` (we don't use Radix Slot). */
export function ButtonLink({
  href,
  variant,
  size,
  className,
  children,
}: { href: string; className?: string; children: React.ReactNode } & VariantProps<
    typeof buttonVariants
  >) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant, size }), className)}>
      {children}
    </Link>
  );
}
