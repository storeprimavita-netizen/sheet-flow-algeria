import { describe, expect, test } from "vitest";
import { auditRedact, MAX_DEPTH } from "./audit-redact";
import { MASKED_NAMES, VISIBLE_NAMES } from "./audit-redact.cases";
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

describe("auditRedact key normalisation", () => {
  const cases = ["secret_token", "meta_access_token", "capi_token", "telegram_bot_token", "zr_api_key", "x-api-key", "apiSecret", "accessToken", "clientSecret", "credentials"];
  test.each(cases)("masks %s", (k) => {
    const s = JSON.stringify(auditRedact({ [k]: "PLAINVAL" }));
    expect(s).not.toContain("PLAINVAL");
    expect(s).toContain("[redacted:");
  });
  test("nested credentials object is masked", () => {
    expect(JSON.stringify(auditRedact({ credentials: { pass: "p" } }))).not.toContain('"p"');
  });
  test("allow-list and non-secret names stay", () => {
    const o = { color_token: "rose", tracking_token_id: "t1", token_count: 2, monkey: "x" };
    expect(auditRedact(o)).toEqual(o);
  });
  test("settings rows with multi-word names", () => {
    for (const key of ["telegram_bot_token", "meta_access_token"]) {
      expect(JSON.stringify(auditRedact({ key, value: "VAL123" }))).not.toContain("VAL123");
    }
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

describe("auditRedact D49 fail-closed", () => {
  test.each(["secret_key", "client_key", "webhook_key", "signing_key", "XApiKey", "telegram.token", "passphrase"])("masks %s", (k) => {
    const s = JSON.stringify(auditRedact({ [k]: "PLAINVAL" }));
    expect(s).not.toContain("PLAINVAL");
    expect(s).toContain("[redacted:");
  });
  test("kv row with dotted name is masked", () => {
    expect(JSON.stringify(auditRedact({ key: "telegram.token", value: "S1" }))).not.toContain("S1");
  });
  test("allow-list stays visible", () => {
    const o = { key: "store_name", keys: ["a"], idempotency_key: "i1", sort_key: 3, cache_key: "c", color_token: "rose", monkey: "x" };
    expect(auditRedact(o)).toEqual(o);
  });
});

describe("auditRedact SEC-1-F acronyms and odd case", () => {
  test.each(MASKED_NAMES)("masks %j", (k) => {
    const s = JSON.stringify(auditRedact({ [k]: "PLAINVAL" }));
    expect(s).not.toContain("PLAINVAL");
    expect(s).toContain("[redacted:");
  });
  test("allow-list and look-alikes stay visible", () => {
    const o = Object.fromEntries(VISIBLE_NAMES.map((n) => [n, "v"]));
    expect(auditRedact(o)).toEqual(o);
  });
  test("depth cap masks the deeper subtree", () => {
    let o: unknown = { leaf: "DEEPVAL" };
    for (let i = 0; i < MAX_DEPTH + 2; i++) o = { n: o };
    expect(JSON.stringify(auditRedact(o))).not.toContain("DEEPVAL");
    expect(JSON.stringify(auditRedact(o))).toContain("[redacted:");
  });
});
