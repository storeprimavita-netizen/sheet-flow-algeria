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
