import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/session";

// Next.js 16 renamed `middleware` to `proxy` (Node.js runtime).
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Run on everything except static assets and the public store (`/s` or `/s/...`):
  // the store never refreshes a session and never sets a cookie. `s(?:/|$)` is an exact
  // segment, so `/settings` still matches. `/api/webhooks` is skipped too: providers
  // send no session cookie and each route checks its own signature.
  matcher: [
    "/((?!s(?:/|$)|api/webhooks(?:/|$)|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
