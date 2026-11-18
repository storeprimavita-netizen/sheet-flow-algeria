import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/session";

// Next.js 16 renamed `middleware` to `proxy` (Node.js runtime).
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Run on everything except static assets and the public store (`/s` or `/s/...`):
  // the store never refreshes a session and never sets a cookie. `s(?:/|$)` is an exact
  // segment, so `/settings` still matches.
  matcher: [
    "/((?!s(?:/|$)|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
