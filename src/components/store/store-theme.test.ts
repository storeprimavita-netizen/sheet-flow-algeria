import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const root = process.cwd();
const read = (p: string) => readFileSync(path.join(root, p), "utf8");
const code = (p: string) => read(p).split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");

describe("store theme", () => {
  test("tokens match skill", () => {
    expect(read("src/components/store/theme.css")).toBe(read(".claude/skills/luxe-modesty-store-theme/references/tokens.css"));
  });

  test("store components lint no hex/rgb/text-white", () => {
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(path.join(root, d))) {
        const rel = `${d}/${f}`;
        if (statSync(path.join(root, rel)).isDirectory()) walk(rel);
        else if (/\.tsx$/.test(f) && !/\.test\./.test(f)) files.push(rel);
      }
    };
    walk("src/components/store");
    walk("src/app/(store)");
    const bad = /(text|bg|border|ring|fill|stroke)-(white|black)\b|#[0-9a-fA-F]{6}\b|rgba?\(/;
    for (const f of files) {
      for (const [i, l] of read(f).split("\n").entries()) {
        if (l.includes("gate-allow-color")) continue;
        expect(bad.test(l), `${f}:${i + 1}`).toBe(false);
      }
    }
    expect(files.length).toBeGreaterThan(0);
  });

  test("store css never imports the app styles", () => {
    const css = read("src/components/store/store.css");
    expect(css.split("\n").filter((l) => l.startsWith("@import"))).toEqual(['@import "./theme.css";']);
    expect(code("src/app/(store)/s/layout.tsx")).not.toMatch(/globals\.css|sonner|getLocale|next\/headers/);
  });

  test("root layouts: store is ar/rtl with no app theme or cookies", () => {
    const store = code("src/app/(store)/s/layout.tsx");
    expect(store).toContain('lang="ar" dir="rtl"');
    expect(store).not.toMatch(/Toaster|cookies\(|THEME_COOKIE|IBM/);
    expect(read("src/app/(app)/layout.tsx")).toContain("<Toaster");
  });
});

// ---- contrast ---------------------------------------------------------------------------
function tokens(block: string) {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})/g)) out[m[1]] = m[2];
  return out;
}
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe("store-contrast", () => {
  const css = read("src/components/store/theme.css");
  const light = tokens(css.slice(0, css.indexOf("@media")));
  const dark = tokens(css.slice(css.indexOf("@media"), css.indexOf(".store-root .ltr")));
  const pairs: [string, string][] = [
    ["ink", "surface-100"], ["ink", "surface-200"], ["ink", "surface-300"], ["ink-muted", "surface-100"], ["ink-muted", "surface-200"],
    ["brand", "surface-100"], ["brand", "surface-200"], ["on-brand", "brand-fill"], ["on-brand", "brand-fill-hover"], ["on-brand", "wine"],
    ["gold-text", "surface-100"], ["gold-text", "surface-300"], ["danger", "surface-100"], ["success", "surface-100"], ["on-brand", "rose"],
  ];
  for (const [name, theme] of [["light", light], ["dark", { ...light, ...dark }]] as const) {
    test(`token pairs >= 4.5:1 in ${name}`, () => {
      for (const [fg, bg] of pairs) expect(ratio(theme[fg], theme[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    });
  }
});

// ---- proxy matcher ------------------------------------------------------------------------
describe("proxy matcher", () => {
  test("proxy /s/x/y skipped vs /app/settings refreshed", async () => {
    const { config } = await import("@/proxy");
    const re = new RegExp(`^${config.matcher[0]}$`);
    for (const p of ["/s", "/s/x/y", "/s/x"]) expect(re.test(p), p).toBe(false);
    for (const p of ["/app/settings", "/settings", "/app/dashboard", "/login", "/sx"]) expect(re.test(p), p).toBe(true);
  });

  test("proxy matcher skips webhooks only", async () => {
    const { config } = await import("@/proxy");
    const { unstable_doesMiddlewareMatch } = await import("next/experimental/testing/server");
    const matches = (url: string) => unstable_doesMiddlewareMatch({ config, url });
    // Slash forms test the matcher only: Next answers them with a 308 before routing.
    const hooks = ["shopify", "lightfunnel", "zrexpress"].flatMap((n) => [`/api/webhooks/${n}`, `/api/webhooks/${n}/`]);
    for (const p of [...hooks, "/api/webhooks", "/s/x/y", "/_next/static/chunks/a.js", "/_next/image"]) expect(matches(p), p).toBe(false);
    for (const p of ["/api/webhooks-extra", "/api/cron/zr-sync", "/app/statistics", "/login"]) expect(matches(p), p).toBe(true);
  });
});
