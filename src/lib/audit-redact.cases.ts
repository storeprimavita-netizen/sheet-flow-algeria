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

/** Wrap `leaf` in `levels` single-key objects, so the leaf sits at depth `levels`. */
const nest = (levels: number, leaf: unknown): unknown => {
  let o = leaf;
  for (let i = 0; i < levels; i++) o = { n: o };
  return o;
};
// Depth cap boundary (64 kept, 65 masked); JSON null is kept at every depth.
PARITY_CASES.push(
  nest(64, null),
  nest(65, null),
  nest(64, { a: null }),
  nest(64, { secret: null }),
  nest(63, { secret: null }),
  nest(64, { secret: "S" }),
  nest(64, { a: "plain" }),
  nest(65, "plain"),
  nest(64, [1, null, "x"]),
  nest(63, [{ secret: "S" }, null]),
);
