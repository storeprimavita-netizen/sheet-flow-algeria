"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();

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
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-lg font-semibold text-primary-foreground">
            M
          </span>
          <div className="leading-tight">
            <p className="text-base font-semibold">MNW ERP</p>
            <p className="text-xs text-muted">Cash on Delivery</p>
          </div>
        </div>

        <Card>
          <CardContent className="space-y-4">
            <div>
              <h1 className="text-lg font-semibold">Sign in</h1>
              <p className="mt-1 text-sm text-muted">Use your MNW ERP account.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {error && (
                <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
              )}

              <Button type="submit" disabled={busy} className="w-full">
                {busy ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
