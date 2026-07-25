"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Languages } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Toggles the `locale` cookie and re-renders server components. */
export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const nextLocale = locale === "ar" ? "en" : "ar";
  const label = nextLocale === "ar" ? "العربية" : "English";

  function toggle() {
    document.cookie = `locale=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="w-full"
      onClick={toggle}
      disabled={isPending}
    >
      <Languages />
      {label}
    </Button>
  );
}
