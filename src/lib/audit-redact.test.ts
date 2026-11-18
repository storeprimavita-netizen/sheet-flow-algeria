import { describe, expect, test } from "vitest";
import { auditRedact } from "./audit-redact";
import { diffRows } from "@/app/app/settings/audit/_lib/diff";

const r = (v: unknown) => auditRedact(v) as Record<string, unknown>;

describe("auditRedact", () => {
  test("masks secret keys, case-insensitive", () => {
    const o = r({ secret: "abc", Api_Key: "k1", name: "x" });
    expect(o.secret).toBe("[redacted:ba7816bf]");
    expect(o.Api_Key).toMatch(/^\[redacted:[0-9a-f]{8}\]$/);
    expect(o.name).toBe("x");
  });
  test("nested objects and arrays", () => {
    const s = JSON.stringify(auditRedact({ a: { b: [{ password: "hunter2" }] } }));
    expect(s).not.toContain("hunter2");
    expect(s).toContain("[redacted:");
  });
  test("non-string values under a secret key are masked", () => {
    const s = JSON.stringify(auditRedact({ tokens: { access: "abc" }, api_keys: ["k1"], secret: 12345 }));
    expect(s).not.toMatch(/abc|k1|12345/);
    expect(s.match(/\[redacted:/g)).toHaveLength(3);
  });
  test("settings key/value shape", () => {
    const o = r({ key: "telegram_bot_token", value: "123:AAxyz" });
    expect(JSON.stringify(o)).not.toContain("123:AAxyz");
    expect(r({ key: "store_name", value: "Shop" }).value).toBe("Shop");
  });
  test("ordinary keys are not masked", () => {
    const o = { color_token: "rose", tracking_token_id: "t1", stopdesk_fee: 400, token_count: 3 };
    expect(auditRedact(o)).toEqual(o);
  });
  test("prefixed value under an innocent key", () => {
    expect(JSON.stringify(auditRedact({ note: "whsec_ABC123" }))).not.toContain("whsec_");
  });
  test("fingerprint is stable, differs per secret, idempotent", () => {
    const f = (s: string) => r({ secret: s }).secret as string;
    expect(f("one")).toBe(f("one"));
    expect(f("one")).not.toBe(f("two"));
    expect(r({ secret: f("one") }).secret).toBe(f("one"));
  });
  test("null and empty stay as is", () => {
    expect(auditRedact({ secret: null, token: "" })).toEqual({ secret: null, token: "" });
    expect(auditRedact(null)).toBeNull();
  });
});

describe("diffRows", () => {
  test("page rows never contain the secret; changed fingerprint is shown", () => {
    const c = diffRows({ id: 1, secret: "whsec_old" }, { id: 1, secret: "whsec_new" });
    expect(JSON.stringify(c)).not.toContain("whsec_");
    expect(c).toHaveLength(1);
    expect(c[0].from.redacted && c[0].to.redacted).toBe(true);
    expect(c[0].from.text).toMatch(/^\[redacted · [0-9a-f]{8}\]$/);
  });
});
