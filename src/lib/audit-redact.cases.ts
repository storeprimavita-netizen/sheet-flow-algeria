/** Shared SQL/TS parity cases for audit_redact / auditRedact (string values only for fingerprints). */
export const MASKED_NAMES = ["XAPIKey", "APISecret", "ZRToken", "IDKey", "sEcReT", "token_", "x_api_key ", "apikey", "secretkey", "accesstoken", "authtoken", "privatekey", "clientsecret", "webhooksecret", "bottoken", "AuthToken"];
export const VISIBLE_NAMES = ["key", "idempotency_key", "color_token", "monkey", "token_count", "monkeys", "hotkey"];
export const PARITY_CASES: unknown[] = [
  Object.fromEntries(MASKED_NAMES.map((n) => [n, "PLAIN_" + n])),
  Object.fromEntries(VISIBLE_NAMES.map((n) => [n, "v_" + n])),
  { secret: "abc", color_token: "rose", tokens: { a: "zz" }, api_keys: ["k1", { b: 2 }] },
  { key: "telegram.token", value: "S1" },
  { key: "store_name", value: "Shop" },
  { a: [{ password: "hunter2", n: { deep: 1 } }], note: "whsec_ABC" },
  { secret: { bb: 1, a: "x y", c: [1, 2, null] } },
  { secret: { ab: 1, "\u0644": 2 } },
  { secret: {} },
  { secret: [] },
  { secret: { q: "a\"b\\c\n" } },
];
