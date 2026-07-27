"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";

import type { Theme } from "@/lib/theme";
import { THEME_COOKIE } from "@/lib/theme";
import { Button } from "@/components/ui/button";

/** Flips the `theme` cookie + <html> class immediately (no flash), then refreshes RSC. */
export function ThemeToggle({ className }: { className?: string }) {
  const router = useRouter();
  const t = useTranslations();
  const [isPending, startTransition] = useTransition();
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("light") ? "light" : "dark");
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("light", next === "light");
    document.documentElement.classList.toggle("dark", next === "dark");
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    setTheme(next);
    startTransition(() => router.refresh());
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className ?? "w-full"}
      onClick={toggle}
      disabled={isPending}
    >
      {theme === "dark" ? <Sun /> : <Moon />}
      {theme === "dark" ? t("theme.light") : t("theme.dark")}
    </Button>
  );
}
