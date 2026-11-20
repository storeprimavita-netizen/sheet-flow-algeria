"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LogOut } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "@/components/ui/button";

export function SignOutButton({
  className,
  size = "sm",
}: {
  className?: string;
  size?: ButtonProps["size"];
}) {
  const router = useRouter();
  const t = useTranslations("common");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signOut() {
    setBusy(true);
    setFailed(false);
    try {
      const { error } = await createClient().auth.signOut();
      if (error) {
        setFailed(true);
        return;
      }
      router.replace("/login");
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={size}
        className={cn("w-full", size === "lg" && "min-h-11", className)}
        disabled={busy}
        aria-busy={busy}
        onClick={signOut}
      >
        <LogOut aria-hidden />
        {t("signOut")}
      </Button>
      {failed && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {t("signOutFailed")}
        </p>
      )}
    </>
  );
}
