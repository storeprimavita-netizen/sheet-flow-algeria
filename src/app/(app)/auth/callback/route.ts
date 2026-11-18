import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Exchanges the PKCE code Supabase appends to email-link redirects (invite
 * acceptance, password recovery) for a session, then continues to `next`.
 * Without this, those flows land with `?code=...` but no established session.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const raw = url.searchParams.get("next") ?? "";
  // Same-origin paths only: "/x" ok; "//evil", "@evil.com", ".evil.com" are not.
  const next = /^\/(?!\/)/.test(raw) ? raw : "/app/dashboard";

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${url.origin}${next}`);
}
