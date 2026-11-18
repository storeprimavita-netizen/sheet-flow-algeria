import { describe, expect, test } from "vitest";
import { auditRedact, showRedacted } from "./audit-redact";

describe("auditRedact", () => {
  test("masks secret-looking keys, case-insensitive", () => {
    const r = auditRedact({ secret: "abc", ApiKey: "k1", name: "x" }) as Record<string, string>;
    expect(r.secret).toBe("[redacted:ba7816bf]");
    expect(r.ApiKey).toMatch(/^\[redacted:[0-9a-f]{8}\]$/);
    expect(r.name).toBe("x");
  });
  test("nested objects and arrays", () => {
    const r = JSON.stringify(auditRedact({ a: { b: [{ password: "hunter2" }] } }));
    expect(r).not.toContain("hunter2");
    expect(r).toContain("[redacted:");
  });
  test("whsec_ value under an innocent key", () => {
    expect(JSON.stringify(auditRedact({ note: "whsec_ABC123" }))).not.toContain("whsec_");
  });
  test("fingerprint is stable and differs per secret", () => {
    const f = (s: string) => (auditRedact({ secret: s }) as { secret: string }).secret;
    expect(f("one")).toBe(f("one"));
    expect(f("one")).not.toBe(f("two"));
  });
  test("null and empty stay as is", () => {
    expect(auditRedact({ secret: null, token: "" })).toEqual({ secret: null, token: "" });
    expect(auditRedact(null)).toBeNull();
  });
  test("display form", () => {
    expect(showRedacted("secret: \"[redacted:ba7816bf]\"")).toBe("secret: \"[redacted · ba7816bf]\"");
  });
});
