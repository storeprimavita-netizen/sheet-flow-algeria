/** Shared SQL/TS parity cases for audit_redact / auditRedact (string values only for fingerprints). */
export const MASKED_NAMES = ["XAPIKey", "APISecret", "ZRToken", "IDKey", "sEcReT", "token_", "x_api_key "];
export const VISIBLE_NAMES = ["key", "idempotency_key", "color_token", "monkey", "token_count"];
export const PARITY_CASES: unknown[] = [
  Object.fromEntries(MASKED_NAMES.map((n) => [n, "PLAIN_" + n])),
  Object.fromEntries(VISIBLE_NAMES.map((n) => [n, "v_" + n])),
  { secret: "abc", color_token: "rose", tokens: { a: "zz" }, api_keys: ["k1", { b: 2 }] },
  { key: "telegram.token", value: "S1" },
  { key: "store_name", value: "Shop" },
  { a: [{ password: "hunter2", n: { deep: 1 } }], note: "whsec_ABC" },
  { secret: { bb: 1, a: "x y", c: [1, 2, null] } },
];
