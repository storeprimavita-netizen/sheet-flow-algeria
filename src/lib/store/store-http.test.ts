import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, test } from "vitest";

/**
 * HTTP checks against a running production build (`npm run build && npx next start -p 3100`).
 * Opt-in: STORE_E2E_URL=http://localhost:3100 STORE_E2E_PATH=/s/<store>/<slug> (a live, published page).
 */
const BASE = process.env.STORE_E2E_URL;
const PATH = process.env.STORE_E2E_PATH ?? "/s/luxe/abaya";

describe.skipIf(!BASE)("store over HTTP", () => {
  test("s response no Set-Cookie, Arabic whatever the locale cookie, no app theme/fonts", async () => {
    const res = await fetch(`${BASE}${PATH}`, { headers: { cookie: "locale=en; theme=light" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toBeNull();
    const html = await res.text();
    expect(html).toMatch(/<html lang="ar" dir="rtl"/);
    expect(html).not.toMatch(/fonts\.googleapis\.com|IBM Plex|sonner/i);
    expect(html).not.toMatch(/<html[^>]*class="[^"]*\b(dark|light)\b/);
  });
  test("404s answer 404 (missing, bad slug, reserved)", async () => {
    for (const p of ["/s/luxe/does-not-exist", "/s/App/x", "/s/app/x", "/s/luxe/Bad_Slug"]) {
      expect((await fetch(`${BASE}${p}`)).status, p).toBe(404);
    }
  });
  test("/s/x/y?preview=1 on a draft is a 404; /app still redirects to login", async () => {
    expect((await fetch(`${BASE}/s/luxe/draft-page?preview=1`)).status).toBe(404);
    const app = await fetch(`${BASE}/app/dashboard`, { redirect: "manual" });
    expect(app.status).toBe(307);
    expect(app.headers.get("location")).toContain("/login");
  });
});

/**
 * Session checks over HTTP. Opt-in with STORE_E2E_URL plus the local Supabase env
 * (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY) and the seed users (docs/TESTING.md).
 */
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function sessionCookie(email: string): Promise<{ header: string; userClient: SupabaseClient }> {
  const jar = new Map<string, string>();
  const client = createServerClient(SB_URL!, SB_KEY!, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { error } = await client.auth.signInWithPassword({ email, password: "SeedDev!2026" });
  if (error) throw error;
  return { header: [...jar].map(([k, v]) => `${k}=${v}`).join("; "), userClient: client };
}

describe.skipIf(!BASE || !SB_URL || !SB_KEY)("store admin over HTTP (agent vs admin session)", () => {
  test("agent hits the 404 boundary on /app/store and a real page editor URL; admin gets the hub", async () => {
    const admin = await sessionCookie("admin@seed.mnw");
    const { data: pages } = await admin.userClient.from("store_pages").select("id").limit(1);
    const pageId = pages?.[0]?.id ?? "00000000-0000-4000-8000-000000000000";
    const agent = await sessionCookie("confirmation@seed.mnw");
    for (const p of ["/app/store", `/app/store/pages/${pageId}`]) {
      const res = await fetch(`${BASE}${p}`, { headers: { cookie: agent.header }, redirect: "manual" });
      // The route streams behind loading.tsx, so Next documents a 200 with noindex and the 404 boundary in the payload.
      const html = await res.text();
      expect(html, `agent ${p}`).toContain("NEXT_HTTP_ERROR_FALLBACK;404");
      expect(html, `agent ${p}`).toContain("noindex");
      expect(html, `agent ${p}`).not.toMatch(/<h1[^>]*>Store</);
    }
    const ok = await fetch(`${BASE}/app/store`, { headers: { cookie: admin.header }, redirect: "manual" });
    expect(ok.status).toBe(200);
    expect(await ok.text()).not.toContain("NEXT_HTTP_ERROR_FALLBACK;404");
  });
});
