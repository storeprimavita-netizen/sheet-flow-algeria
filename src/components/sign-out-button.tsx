"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "@/components/ui/button";

export function SignOutButton({
  className,
  size = "sm",
  errorAs = "inline",
  ...rest
}: Omit<ButtonProps, "onClick" | "children" | "variant"> & {
  /** "toast" for menus, where an inline alert would sit inside role="menu". */
  errorAs?: "inline" | "toast";
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
      if (error) throw error;
      // stay busy until navigation lands on /login
      router.replace("/login");
      router.refresh();
    } catch {
      setBusy(false);
      if (errorAs === "toast") toast.error(t("signOutFailed"));
      else setFailed(true);
    }
  }

  return (
    <>
      <Button
        {...rest}
        type="button"
        variant="outline"
        size={size}
        className={cn("w-full", size === "lg" && "min-h-11", className)}
        disabled={busy}
        aria-busy={busy}
        onClick={signOut}
      >
        <LogOut aria-hidden className="rtl:-scale-x-100" />
        {t("signOut")}
      </Button>
      {failed && (
        <p role="alert" className="mt-2 text-center text-sm text-destructive">
          {t("signOutFailed")}
        </p>
      )}
    </>
  );
}
