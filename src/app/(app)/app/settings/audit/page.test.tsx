import { describe, expect, test, vi } from "vitest";

const calls: [string, ...unknown[]][] = [];
const builder: Record<string, unknown> = {};
for (const m of ["select", "eq", "order", "limit", "gte", "lt"]) {
  builder[m] = (...a: unknown[]) => {
    calls.push([m, ...a]);
    return builder;
  };
}
builder.then = (res: (v: unknown) => void) => res({ data: [], error: null });

vi.mock("server-only", () => ({}));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (k: string) => k }));
vi.mock("@/lib/rbac", () => ({ requireAdminProfile: async () => ({ workspaceId: "ws" }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: () => builder }) }));
vi.mock("../settings-tabs", () => ({ SettingsTabs: () => null }));
vi.mock("./audit-filter-bar", () => ({ AuditFilterBar: () => null }));
vi.mock("./audit-table", () => ({ AuditTable: () => null }));
vi.mock("@/components/page-header", () => ({ PageHeader: () => null }));
import AuditPage from "./page";

describe("AuditPage date bounds", () => {
  test("from is inclusive at 00:00 +01:00, to is exclusive at the next day", async () => {
    calls.length = 0;
    await AuditPage({ searchParams: Promise.resolve({ from: "2026-02-10", to: "2026-03-01" }) });
    expect(calls).toContainEqual(["gte", "created_at", "2026-02-10T00:00:00+01:00"]);
    expect(calls).toContainEqual(["lt", "created_at", "2026-03-02T00:00:00+01:00"]);
  });
});
