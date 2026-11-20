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
  test.each(["en", "ar"] as const)("%s: filtered empty state uses the no-match copy", (loc) => {
    const m = loc === "en" ? en : ar;
    const html = render(loc, [], true);
    expect(html).toContain(m.team.auditNoMatch);
    expect(html).not.toContain(m.team.auditNone);
  });
  test("empty key gets a label", () => {
    expect(render("en")).toContain(en.audit.emptyKey);
  });
  test("filtered empty state: Clear link goes to the unfiltered page", () => {
    expect(render("en", [], true)).toContain(`href="/app/settings/audit"`);
    expect(render("en", [], false)).not.toContain(`href="/app/settings/audit"`);
  });
  test("empty state without filters shows the none copy", () => {
    expect(render("en", [], false)).toContain(en.team.auditNone);
  });
  test("ar: empty-key label is wrapped in an rtl bdi; en is not", () => {
    expect(render("ar")).toContain(`<bdi dir="rtl">${ar.audit.emptyKey}</bdi>`);
    expect(render("en")).not.toContain(`<bdi dir="rtl">`);
  });
  test("pill has a focus-visible ring", () => {
    expect(render("en")).toMatch(/role="note"[^>]*focus-visible:ring-2/);
  });
  test("colliding labels are both visible", () => {
    const both = diffRows({ "a.b": 1, a: { b: 1 }, "x › y": 1 }, { "a.b": 2, a: { b: 2 }, "x › y": 2 });
    const html = render("en", [{ ...row, changes: both }]).replace(/<[^>]*>/g, "");
    expect(html).toContain("&quot;x › y&quot;");
    expect(html).toContain("&quot;a.b&quot;");
    expect(html).toContain("a › b");
  });
});
