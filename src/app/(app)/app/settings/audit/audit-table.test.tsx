import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import en from "@/messages/en.json";
import ar from "@/messages/ar.json";
import { diffRows } from "./_lib/diff";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: () => {}, push: () => {}, refresh: () => {} }),
  usePathname: () => "/app/settings/audit",
  useSearchParams: () => new URLSearchParams(),
}));
import { AuditTable, type AuditRow } from "./audit-table";

const changes = diffRows(
  { "a.b": 1, "": 1, a: { b: 1 }, api_key: "OLD", items: [{ secret: "x" }] },
  { "a.b": 2, "": 2, a: { b: 1 }, api_key: "NEW", items: [{ secret: "y" }] },
);
const row: AuditRow = { id: 1, created_at: "2026-01-01T00:00:00Z", table_name: "settings", action: "UPDATE", actor_name: "A", changes };

const render = (locale: "en" | "ar", rows = [row], filtered = false) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : ar} timeZone="UTC">
      <AuditTable rows={rows} filtered={filtered} />
    </NextIntlClientProvider>,
  );

describe("AuditTable", () => {
  test.each(["en", "ar"] as const)("%s: two lists per row, pill with fingerprint aria-label, no '; '", (loc) => {
    const html = render(loc);
    expect(html.match(/<ul/g)).toHaveLength(2);
    expect(html.replace(/<[^>]*>/g, "")).not.toContain("; "); // text only: attributes may hold prose
    expect(html).toContain('role="note"');
    const fp = changes.find((c) => c.key === "api_key")!.from.fingerprint!;
    const aria = (loc === "en" ? en : ar).audit.redactedAria.replace("{fp}", fp);
    expect(html).toContain(`aria-label="${aria}"`);
    expect(html).not.toMatch(/OLD|NEW/);
  });
  test("colliding paths render without duplicate-key warnings", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    render("en");
    expect(err.mock.calls.flat().join(" ")).not.toMatch(/same key|unique "key"/);
    err.mockRestore();
    expect(new Set(changes.map((c) => c.id)).size).toBe(changes.length);
  });
  test("empty key gets a label", () => {
    expect(render("en")).toContain(en.audit.emptyKey);
  });
  test("empty state offers clearing filters only when filtered", () => {
    expect(render("en", [], true)).toContain("/app/settings/audit");
    expect(render("en", [], false)).not.toContain('href="/app/settings/audit"');
  });
});
