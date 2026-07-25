"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocaleSwitcher } from "@/components/locale-switcher";

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    // Created in the handler (not at render time) so the page can prerender
    // without Supabase env vars present at build time.
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setBusy(false);

    if (error) {
      setError(error.message);
      return;
    }
    router.replace("/app/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="glass-card w-full max-w-md rounded-2xl p-8">
        <div className="mb-6 flex items-center justify-end">
          <LocaleSwitcher />
        </div>

        <div className="mb-6 text-center">
          <div className="text-5xl">🛍️</div>
          <h1 className="mt-2 text-3xl font-bold text-gradient">MNW ERP</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@mnw.xxx"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="password">{t("password")}</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5"
            />
          </div>

          {error && (
            <p className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? t("busy") : t("submit")}
          </Button>
        </form>
      </div>
    </div>
  );
}
